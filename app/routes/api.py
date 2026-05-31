"""API routes blueprint."""
import os
import tempfile
import uuid
import requests as http_requests
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
from app.services.llm import analyze_transcript
from app.services.stt import AzureSTTService
from app.services.analysis import TranscriptAnalyzer

api_bp = Blueprint('api', __name__)

ALLOWED_AUDIO_EXTENSIONS = {'wav', 'mp3', 'ogg', 'flac', 'm4a', 'wma'}
_ISSUE_ICONS = ['🎯', '💡', '⚡', '🔍', '📌']


def _transform(raw: dict, speaker: str) -> dict:
    """Map Gemini JSON schema output to the shape the frontend expects."""
    if raw.get('transcript_too_short'):
        return {'error': '逐字稿太短，請至少輸入 30 字', 'transcript_too_short': True}

    analysis  = raw.get('analysis', {})
    rewritten = raw.get('rewritten_transcript', {})

    improved_transcript = rewritten.get('content', '')

    vocab_suggestions = [
        {
            'original':     item.get('original', ''),
            'alternatives': [item.get('revised', '')] if item.get('revised') else [],
            'reason':       item.get('reason', ''),
        }
        for item in rewritten.get('change_log', [])[:6]
        if item.get('original')
    ]

    suggestions = []
    for i, item in enumerate(analysis.get('top_issues', [])):
        quote = item.get('quote', '')
        text  = item.get('reason', '')
        if quote:
            text += f'（原句：「{quote}」）'
        suggestions.append({
            'icon':     _ISSUE_ICONS[i % len(_ISSUE_ICONS)],
            'category': item.get('issue', f'問題 {i+1}'),
            'text':     text,
        })

    score    = analysis.get('overall_score', 0)
    feedback = analysis.get('structure', {}).get('feedback', '')
    summary  = f'整體評分：{score}/10。{feedback}' if feedback else f'整體評分：{score}/10。'

    return {
        'speaker':             speaker,
        'improved_transcript': improved_transcript,
        'vocab_suggestions':   vocab_suggestions,
        'suggestions':         suggestions,
        'summary':             summary,
    }


@api_bp.route('/hello', methods=['GET'])
def hello():
    return jsonify({'message': 'Hello from Flask!'})


@api_bp.route('/status', methods=['GET'])
def status():
    return jsonify({'status': 'running', 'version': '1.0'})


@api_bp.route('/analyze', methods=['POST'])
def analyze():
    """Analyze transcript and return improved version with suggestions."""
    data       = request.get_json() or {}
    transcript = data.get('transcript', '')
    speaker    = data.get('speaker', 'trump')

    if not transcript:
        return jsonify({'error': '請提供逐字稿'}), 400

    try:
        raw    = analyze_transcript(transcript, speaker)
        result = _transform(raw, speaker)
        if result.get('transcript_too_short'):
            return jsonify(result), 422
        return jsonify(result)
    except EnvironmentError as e:
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        return jsonify({'error': f'分析失敗：{e}'}), 500


@api_bp.route('/advanced-analysis', methods=['POST'])
def advanced_analysis():
    """
    Perform advanced linguistic analysis on transcript.
    Includes: filler words, vocabulary richness, sentiment trajectory,
    key phrases, and data vs emotion ratio.
    """
    try:
        data = request.get_json() or {}
        transcript = data.get('transcript', '')
        
        if not transcript or len(transcript.strip()) < 10:
            return jsonify({'error': '逐字稿過短，請至少輸入 10 字'}), 400
        
        analyzer = TranscriptAnalyzer(transcript)
        report = analyzer.generate_full_report()
        
        return jsonify({
            'success': True,
            'analysis': report,
        })
    
    except Exception as e:
        current_app.logger.error(f'Advanced analysis error: {str(e)}', exc_info=True)
        return jsonify({
            'error': f'分析失敗：{str(e)}',
            'reason': 'analysis_error',
        }), 500


@api_bp.route('/progress', methods=['GET'])
def get_progress():
    return jsonify({
        'total_sessions': 0,
        'avg_score':      None,
        'best_score':     None,
        'streak_days':    0,
        'sessions':       [],
    })


@api_bp.route('/sessions', methods=['POST'])
def save_session():
    return jsonify({'status': 'ok', 'id': 'demo-001'})


@api_bp.route('/translate', methods=['POST'])
def translate_text():
    """Translate Chinese text to English via Azure Translator."""
    data = request.get_json() or {}
    text = data.get('text', '').strip()
    if not text:
        return jsonify({'error': '請提供文字'}), 400

    key = os.environ.get('AZURE_TRANSLATOR_KEY')
    if not key:
        return jsonify({'error': '翻譯服務未設定'}), 500

    region = os.environ.get('AZURE_TRANSLATOR_REGION', '')
    headers = {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/json',
    }
    if region:
        headers['Ocp-Apim-Subscription-Region'] = region

    try:
        resp = http_requests.post(
            'https://api.cognitive.microsofttranslator.com/translate',
            params={'api-version': '3.0', 'from': 'zh-Hant', 'to': 'en'},
            headers=headers,
            json=[{'text': text}],
            timeout=15,
        )
        if not resp.ok:
            return jsonify({'error': f'Azure 錯誤 {resp.status_code}：{resp.text}'}), 502
        translated = resp.json()[0]['translations'][0]['text']
        return jsonify({'translated': translated})
    except Exception as e:
        return jsonify({'error': f'翻譯失敗：{e}'}), 500


@api_bp.route('/transcribe', methods=['POST'])
def transcribe_audio():
    """Transcribe audio file to text using Azure Speech-to-Text service."""
    try:
        # Validate file upload
        if 'audio' not in request.files:
            return jsonify({'error': '請提供音頻文件'}), 400
        
        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify({'error': '未選擇音頻文件'}), 400
        
        # Validate file extension
        filename = secure_filename(audio_file.filename)
        file_ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
        
        if file_ext not in ALLOWED_AUDIO_EXTENSIONS:
            return jsonify({
                'error': f'不支援的音頻格式。支援格式：{", ".join(ALLOWED_AUDIO_EXTENSIONS)}'
            }), 400
        
        # Save to temporary location
        unique_filename = f'{uuid.uuid4().hex}_{filename}'
        temp_dir = tempfile.gettempdir()
        temp_file_path = os.path.join(temp_dir, unique_filename)
        
        try:
            audio_file.save(temp_file_path)
            
            if not os.path.exists(temp_file_path) or os.path.getsize(temp_file_path) == 0:
                raise IOError('Failed to save audio file')
            
            # Transcribe with Azure STT
            stt_service = AzureSTTService()
            result = stt_service.transcribe_from_file(temp_file_path)
            
            return jsonify(result)
        
        finally:
            # Clean up temporary file
            try:
                if os.path.exists(temp_file_path):
                    os.remove(temp_file_path)
            except Exception as e:
                current_app.logger.warning(f'Failed to clean up temp file: {e}')
    
    except EnvironmentError as e:
        current_app.logger.error(f'Configuration error: {str(e)}')
        return jsonify({'error': str(e), 'reason': 'config_error'}), 500
    
    except IOError as e:
        return jsonify({'error': f'文件保存失敗：{str(e)}', 'reason': 'file_io_error'}), 400
    
    except Exception as e:
        current_app.logger.error(f'Transcription error: {str(e)}', exc_info=True)
        return jsonify({'error': f'轉錄失敗：{str(e)}', 'reason': 'service_error'}), 500

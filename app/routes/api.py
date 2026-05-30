"""API routes blueprint."""
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
import os
import tempfile
import uuid
from app.services.llm import analyze_transcript
from app.services.stt import AzureSTTService

api_bp = Blueprint('api', __name__)

# Allowed audio file extensions
ALLOWED_AUDIO_EXTENSIONS = {'wav', 'mp3', 'ogg', 'flac', 'm4a', 'wma'}


@api_bp.route('/hello', methods=['GET'])
def hello():
    return jsonify({'message': 'Hello from Flask!'})


@api_bp.route('/status', methods=['GET'])
def status():
    return jsonify({'status': 'running', 'version': '1.0'})


@api_bp.route('/analyze', methods=['POST'])
def analyze():
    """Analyze transcript and return improved version with suggestions."""
    data = request.get_json() or {}
    transcript = data.get('transcript', '')
    speaker = data.get('speaker', 'trump')

    if not transcript:
        return jsonify({'error': '請提供逐字稿'}), 400

    try:
        result = analyze_transcript(transcript, speaker)
        return jsonify(result)
    except EnvironmentError as e:
        return jsonify({'error': str(e)}), 500
    except Exception as e:
        return jsonify({'error': f'分析失敗：{e}'}), 500


@api_bp.route('/progress', methods=['GET'])
def get_progress():
    """Return user training progress."""
    # TODO: Integrate with database
    return jsonify({
        'total_sessions': 0,
        'avg_score': None,
        'best_score': None,
        'streak_days': 0,
        'sessions': [],
    })


@api_bp.route('/sessions', methods=['POST'])
def save_session():
    """Save a completed training session."""
    # TODO: Save to database
    return jsonify({'status': 'ok', 'id': 'demo-001'})


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

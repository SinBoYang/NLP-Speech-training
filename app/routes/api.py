"""API routes blueprint."""
from flask import Blueprint, request, jsonify
from app.services.llm import analyze_transcript

api_bp = Blueprint('api', __name__)


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

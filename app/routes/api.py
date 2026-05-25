"""API routes blueprint."""
from flask import Blueprint, request, jsonify

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

    # TODO: Integrate actual NLP pipeline (translation, sentiment, LLM)
    speaker_labels = {'trump': '川普', 'mlk': '金恩博士', 'xu': '許智誠'}

    return jsonify({
        'improved_transcript': f'[{speaker_labels.get(speaker, speaker)} 風格改善版本]\n\n{transcript}',
        'suggestions': [
            {'category': '語言表達', 'icon': '📝', 'text': '使用更有力的動詞和具體名詞，避免模糊的描述方式。'},
            {'category': '情緒張力', 'icon': '🎭', 'text': '在關鍵論點前加入情緒鋪墊，讓聽眾有心理準備接受核心訊息。'},
            {'category': '節奏控制', 'icon': '⏱️', 'text': '善用停頓來強調重點，在重要句子後停頓 0.5–1 秒。'},
            {'category': '邏輯結構', 'icon': '🏗️', 'text': '嘗試使用「問題—衝突—解決」三段式結構，提升說服力。'},
            {'category': '開場白', 'icon': '🚀', 'text': '用引人入勝的故事或數據作為開場，在前 30 秒抓住聽眾注意力。'},
        ],
        'scores': {
            'vocabulary': 72,
            'pacing': 65,
            'emotion': 58,
            'structure': 80,
            'persuasion': 70,
        },
        'summary': f'你的演說展現了清晰的主題和真誠的表達。透過{speaker_labels.get(speaker, speaker)}風格的調整，可以更有效地傳達核心訊息。',
    })


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

"""API routes blueprint."""
from flask import Blueprint, jsonify

api_bp = Blueprint('api', __name__)


@api_bp.route('/hello', methods=['GET'])
def hello():
    """Say hello."""
    return jsonify({'message': 'Hello from Flask!'})


@api_bp.route('/status', methods=['GET'])
def status():
    """Check service status."""
    return jsonify({'status': 'running', 'version': '1.0'})

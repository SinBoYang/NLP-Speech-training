"""Flask application factory."""
import os
from flask import Flask
from dotenv import load_dotenv
from config import config

# Load environment variables
load_dotenv()


def create_app(config_name='development'):
    """Create and configure Flask app."""
    app = Flask(__name__, template_folder='../templates', static_folder='../static')
    
    # Load configuration
    config_obj = config.get(config_name, config['default'])
    app.config.from_object(config_obj)
    
    # Ensure environment variables are set in app.config
    app.config['AZURE_SPEECH_KEY'] = os.getenv('AZURE_SPEECH_KEY')
    app.config['AZURE_SPEECH_REGION'] = os.getenv('AZURE_SPEECH_REGION')
    app.config['GOOGLE_GENERATIVE_AI_API_KEY'] = os.getenv('GOOGLE_GENERATIVE_AI_API_KEY')
    
    # Register blueprints
    from app.routes.main import main_bp
    from app.routes.api import api_bp
    
    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp, url_prefix='/api')
    
    return app

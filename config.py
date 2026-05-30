"""Application configuration."""
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Config:
    """Base configuration."""
    DEBUG = False
    TESTING = False
    
    # Azure Speech-to-Text Settings
    AZURE_SPEECH_KEY = os.getenv('AZURE_SPEECH_KEY')
    AZURE_SPEECH_REGION = os.getenv('AZURE_SPEECH_REGION')
    
    # Google Generative AI Settings
    GOOGLE_GENERATIVE_AI_API_KEY = os.getenv('GOOGLE_GENERATIVE_AI_API_KEY')
    
    # Speech Language Settings
    SPEECH_LANGUAGE = os.getenv('SPEECH_LANGUAGE', 'zh-TW')
    
    # Flask Settings
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')


class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig,
}

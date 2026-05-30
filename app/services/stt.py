"""Azure Speech-to-Text (STT) service."""
import os
import azure.cognitiveservices.speech as speechsdk
from flask import current_app


class AzureSTTService:
    """Speech-to-Text service using Azure Cognitive Services."""
    
    def __init__(self):
        """Initialize Azure Speech Service client."""
        self.subscription_key = os.getenv('AZURE_SPEECH_KEY')
        self.region = os.getenv('AZURE_SPEECH_REGION')
        self.language = os.getenv('SPEECH_LANGUAGE', 'zh-TW')
        
        if not self.subscription_key or not self.region:
            raise EnvironmentError(
                'Azure STT 配置缺失。請設定 AZURE_SPEECH_KEY 和 AZURE_SPEECH_REGION'
            )
        
        # Create speech config
        self.speech_config = speechsdk.SpeechConfig(
            subscription=self.subscription_key,
            region=self.region
        )
        
        # Set speech recognition language
        self.speech_config.speech_recognition_language = self.language

    def transcribe_from_file(self, file_path: str) -> dict:
        """
        Transcribe audio file to text.
        
        Args:
            file_path: Path to audio file (should be WAV format for best compatibility)
        
        Returns:
            Dictionary containing transcribed text and status
        """
        try:
            # Verify file exists
            if not os.path.exists(file_path):
                return {
                    'success': False,
                    'error': '音頻文件不存在或已被刪除。',
                    'reason': 'file_not_found',
                }
            
            file_size = os.path.getsize(file_path)
            if file_size == 0:
                return {
                    'success': False,
                    'error': '音頻文件為空。',
                    'reason': 'empty_file',
                }
            
            _, file_ext = os.path.splitext(file_path)
            current_app.logger.debug(
                f'Transcribing: {file_path} ({file_size} bytes)'
            )
            
            # Create audio config from file
            audio_config = speechsdk.audio.AudioConfig(filename=file_path)
            
            # Create speech recognizer
            recognizer = speechsdk.SpeechRecognizer(
                speech_config=self.speech_config,
                audio_config=audio_config
            )
            
            # Perform recognition
            result = recognizer.recognize_once()
            
            if result.reason == speechsdk.ResultReason.RecognizedSpeech:
                transcript = result.text
                current_app.logger.info(
                    f'Transcribed: {len(transcript)} chars'
                )
                return {
                    'success': True,
                    'transcript': transcript,
                }
            
            elif result.reason == speechsdk.ResultReason.NoMatch:
                current_app.logger.warning('No speech detected')
                return {
                    'success': False,
                    'error': (
                        '無法識別語音。請檢查：\n'
                        '• 音頻質量是否清晰\n'
                        '• 是否為支持的語言（繁體中文 zh-TW）\n'
                        '• 音頻是否包含人聲'
                    ),
                    'reason': 'no_speech_detected',
                }
            
            elif result.reason == speechsdk.ResultReason.Canceled:
                cancellation = result.cancellation_details
                error_msg = f'{cancellation.reason}'
                if cancellation.error_details:
                    error_msg += f': {cancellation.error_details}'
                
                current_app.logger.error(f'Transcription canceled - {error_msg}')
                return {
                    'success': False,
                    'error': error_msg,
                    'reason': 'recognition_canceled',
                }
        
        except FileNotFoundError as e:
            current_app.logger.error(f'File not found: {str(e)}')
            return {
                'success': False,
                'error': '無法找到音頻文件。',
                'reason': 'file_not_found',
            }
        
        except Exception as e:
            error_str = str(e)
            current_app.logger.error(f'STT Error: {error_str}', exc_info=True)
            return {
                'success': False,
                'error': f'轉錄服務出錯：{error_str}',
                'reason': 'service_error',
            }

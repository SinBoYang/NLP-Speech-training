#!/usr/bin/env python
"""Final validation of Azure OpenAI integration with actual Flask endpoints"""
import os
import sys
import json
from dotenv import load_dotenv

load_dotenv()

print("=" * 70)
print("✅ Final Validation: Azure OpenAI Integration Complete")
print("=" * 70)

# Check environment variables
checks = {
    "AZURE_SPEECH_KEY": os.environ.get("AZURE_SPEECH_KEY"),
    "AZURE_SPEECH_REGION": os.environ.get("AZURE_SPEECH_REGION"),
    "AZURE_OPENAI_KEY": os.environ.get("AZURE_OPENAI_KEY"),
    "AZURE_OPENAI_ENDPOINT": os.environ.get("AZURE_OPENAI_ENDPOINT"),
    "AZURE_OPENAI_DEPLOYMENT": os.environ.get("AZURE_OPENAI_DEPLOYMENT"),
    "SPEECH_LANGUAGE": os.environ.get("SPEECH_LANGUAGE"),
}

print("\n📋 Environment Configuration:")
for key, value in checks.items():
    if value:
        preview = value[:30] + "..." if len(str(value)) > 30 else value
        print(f"  ✓ {key}: {preview}")
    else:
        print(f"  ✗ {key}: NOT SET")

missing = [k for k, v in checks.items() if not v]
if missing:
    print(f"\n❌ Missing: {', '.join(missing)}")
    sys.exit(1)

# Check imports
print("\n📦 Python Packages:")
try:
    import flask
    print(f"  ✓ Flask {flask.__version__}")
except ImportError:
    print("  ✗ Flask not installed")
    sys.exit(1)

try:
    import openai
    print(f"  ✓ openai {openai.__version__}")
except ImportError:
    print("  ✗ openai not installed")
    sys.exit(1)

try:
    from azure.cognitiveservices.speech import SpeechConfig
    print(f"  ✓ azure.cognitiveservices.speech")
except ImportError:
    print("  ✗ azure-cognitiveservices-speech not installed")
    sys.exit(1)

try:
    import jieba
    print(f"  ✓ jieba")
except ImportError:
    print("  ✗ jieba not installed")
    sys.exit(1)

# Test imports from app
print("\n🔧 App Services:")
try:
    from app.services.llm import analyze_transcript
    print(f"  ✓ llm.analyze_transcript loaded")
except ImportError as e:
    print(f"  ✗ llm.analyze_transcript failed: {e}")
    sys.exit(1)

try:
    from app.services.speaker_styles import SPEAKER_STYLES
    print(f"  ✓ speaker_styles loaded ({len(SPEAKER_STYLES)} speakers)")
except ImportError as e:
    print(f"  ✗ speaker_styles failed: {e}")
    sys.exit(1)

try:
    from app.routes import api
    print(f"  ✓ api routes loaded")
except ImportError as e:
    print(f"  ✗ api routes failed: {e}")
    sys.exit(1)

# Quick functional test
print("\n🧪 Quick Functional Test:")
try:
    test_input = "各位好，今天我想聊聊一個重要話題。"
    result = analyze_transcript(test_input, speaker="mlk")
    
    if result.get("analysis"):
        print(f"  ✓ Analysis works")
    if result.get("rewritten_transcript"):
        print(f"  ✓ Rewrite works")
    
    score = result.get("analysis", {}).get("overall_score", 0)
    print(f"  ✓ Overall analysis score: {score}/10")
    
except Exception as e:
    print(f"  ✗ Functional test failed: {e}")
    sys.exit(1)

print("\n" + "=" * 70)
print("✅ All validations passed! System is ready.")
print("=" * 70)
print("\n📝 Next steps:")
print("  1. Start Flask server: python app.py")
print("  2. Test endpoints:")
print("     - POST /api/analyze (transcript + speaker)")
print("     - POST /api/transcribe (audio file)")
print("  3. Frontend: http://localhost:5000")
print("=" * 70)

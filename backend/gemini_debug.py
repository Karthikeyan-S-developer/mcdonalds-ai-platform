import os
import sys
import traceback
sys.path.insert(0, os.getcwd())
from app.env_loader import load_env_file
load_env_file()
print('GEMINI_API_KEY', bool(os.getenv('GEMINI_API_KEY')))
from app.gemini_service import GeminiAIService
svc = GeminiAIService()
print('client type', type(svc.client).__name__)
print('model_name', svc.model_name)
if svc.client:
    print('has generate_content', hasattr(svc.client.models, 'generate_content'))
    print('methods containing generate:', [m for m in dir(svc.client.models) if 'generate' in m])
    try:
        resp = svc._generate_text('Test Gemini connection from backend.')
        print('resp type', type(resp).__name__)
        print('resp repr', repr(resp))
    except Exception:
        traceback.print_exc()
else:
    print('No Gemini client available.')

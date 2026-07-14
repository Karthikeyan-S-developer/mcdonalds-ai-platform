from pathlib import Path
import sys
import os

sys.path.insert(0, str(Path.cwd()))
from app.env_loader import load_env_file
load_env_file()
from app.gemini_service import GeminiAIService

s = GeminiAIService()
print('api_key=', bool(s.api_key))
print('client=', type(s.client).__name__ if s.client else None)
prompt = 'Please respond with a unique two-sentence summary of recent performance.'
print('prompt=', prompt)
response = s.client.models.generate_content(model=s.model_name, contents=prompt)
print('direct response type:', type(response))
print('response repr:', repr(response))
print('response attrs:', [a for a in dir(response) if not a.startswith('_')])
print('response text attr:', getattr(response, 'text', None))
print('response contents attr:', getattr(response, 'contents', None))
try:
    print('response text repr:', repr(response.text))
except Exception as e:
    print('response.text exception:', e)
try:
    print('response contents repr:', repr(response.contents))
except Exception as e:
    print('response.contents exception:', e)
print('response as str:', str(response))

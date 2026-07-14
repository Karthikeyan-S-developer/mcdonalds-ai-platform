import os
import sys
sys.path.insert(0, os.getcwd())
from app.env_loader import load_env_file
load_env_file()
from google import genai
client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))
print('client', type(client))
try:
    models = list(client.models.list())
    print('model count', len(models))
    for m in models[:50]:
        name = getattr(m, 'name', None)
        actions = getattr(m, 'supported_actions', None)
        try:
            print('MODEL:', name, 'ACTIONS:', actions)
        except Exception:
            print('MODEL:', name, 'ACTIONS: <invalid>')
except Exception as e:
    import traceback; traceback.print_exc()

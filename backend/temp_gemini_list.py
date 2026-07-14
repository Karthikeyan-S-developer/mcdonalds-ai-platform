from pathlib import Path
import sys
import os

sys.path.insert(0, str(Path.cwd()))
from app.env_loader import load_env_file
load_env_file()
from google import genai

client = genai.Client(api_key=os.getenv('GEMINI_API_KEY'))
pager = client.models.list()
with open('gemini_models_list.txt', 'w', encoding='utf-8') as f:
    count = 0
    for item in pager:
        count += 1
        f.write(f'ITEM {count}: type={type(item)}\n')
        for attr in ['model_id', 'name', 'display_name', 'id', 'description', 'supported_input_types', 'supported_output_types']:
            if hasattr(item, attr):
                f.write(f' {attr}={getattr(item, attr)}\n')
        f.write(repr(item) + '\n-----\n')
    f.write(f'total={count}\n')
print('wrote gemini_models_list.txt', count)

import json
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8000"
HEADERS = {"Content-Type": "application/json"}

login_data = {"email": "admin@mcdonalds.com", "password": "AdminPass123"}
req = urllib.request.Request(BASE + "/api/auth/login", data=json.dumps(login_data).encode("utf-8"), headers=HEADERS, method="POST")
try:
    with urllib.request.urlopen(req, timeout=20) as resp:
        body = resp.read().decode("utf-8")
        print("LOGIN STATUS", resp.status)
        print(body)
        token = json.loads(body)["access_token"]
except urllib.error.HTTPError as e:
    print("LOGIN HTTP ERROR", e.code)
    print(e.read().decode("utf-8"))
    raise SystemExit(1)
except Exception as exc:
    print("LOGIN ERROR", exc)
    raise SystemExit(1)

headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
for path, method, body in [('/api/analytics/gemini-insights?role=admin', 'GET', None), ('/api/chatbot/message', 'POST', {'message': 'How are sales today?'})]:
    print('\nCALL', method, path)
    data = None
    if body is not None:
        data = json.dumps(body).encode('utf-8')
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            print('STATUS', resp.status)
            print(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print('HTTP ERROR', e.code)
        print(e.read().decode('utf-8'))
    except Exception as exc:
        print('ERROR', exc)

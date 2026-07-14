import json
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:8000"
HEADERS = {"Content-Type": "application/json"}

requests = [
    ("/api/analytics/gemini-insights?role=admin", "GET", None),
    ("/api/chatbot/message", "POST", {"message": "How are sales today?"}),
]

for path, method, body in requests:
    print("CALL", method, path)
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(BASE + path, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            print("STATUS", resp.status)
            print(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print("HTTP ERROR", e.code)
        print(e.read().decode("utf-8"))
    except Exception as exc:
        print("ERROR", exc)

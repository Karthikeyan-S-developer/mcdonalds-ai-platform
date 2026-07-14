import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.env_loader import load_env_file


def test_load_env_file_reads_key_without_python_dotenv(tmp_path, monkeypatch):
    env_path = tmp_path / ".env"
    env_path.write_text("GEMINI_API_KEY=test-key\nJWT_SECRET_KEY=test-secret\n", encoding="utf-8")

    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)

    load_env_file(str(env_path))

    assert os.environ["GEMINI_API_KEY"] == "test-key"
    assert os.environ["JWT_SECRET_KEY"] == "test-secret"

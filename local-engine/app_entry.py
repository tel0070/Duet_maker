"""PyInstaller entry point — bundles local-engine into a single Windows
executable so running it doesn't require a separate Python install. See
docs/DEPLOYMENT.md and the "Standalone executable" section of this
directory's README for how this is built (`.github/workflows/
build-local-engine-exe.yml`, run on a real windows-latest GitHub Actions
runner, since a Windows .exe cannot be cross-compiled from Linux/macOS).

Behavior is identical to `uvicorn app.main:app --host 127.0.0.1 --port 8000`
— this file exists only because PyInstaller needs a single script entry
point, not a `module:attribute` string.
"""

import uvicorn

from app.main import app

if __name__ == "__main__":
    print("Duet Maker local-engine — http://127.0.0.1:8000 (health check: /health)")
    print("이 창을 닫으면 로컬 엔진이 종료됩니다. 종료하려면 Ctrl+C를 누르세요.")
    uvicorn.run(app, host="127.0.0.1", port=8000)

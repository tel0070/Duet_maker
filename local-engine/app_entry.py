"""PyInstaller entry point — bundles local-engine (and, when the build
workflow has copied apps/web's production build into local-engine/static
first, the web app itself) into a single Windows executable, so running it
needs neither a separate Python install nor a separate `pnpm dev`. See
docs/DEPLOYMENT.md and local-engine/README.md's "Standalone executable"
section for how this is built (`.github/workflows/build-local-engine-exe.yml`,
run on a real windows-latest GitHub Actions runner, since a Windows .exe
cannot be cross-compiled from Linux/macOS).

Behavior is otherwise identical to
`uvicorn app.main:app --host 127.0.0.1 --port 8000` — this file exists only
because PyInstaller needs a single script entry point, not a
`module:attribute` string.
"""

import threading
import time
import webbrowser

import uvicorn

from app.main import app

URL = "http://127.0.0.1:8000/"


def _open_browser_once_ready() -> None:
    # The server isn't listening yet when this thread starts (uvicorn.run()
    # below blocks the main thread) — poll briefly instead of guessing a
    # fixed delay, so this works the same on a fast machine and a slow one.
    import urllib.request

    for _ in range(100):  # up to ~20s
        try:
            urllib.request.urlopen(f"{URL}health", timeout=0.5)
            break
        except Exception:
            time.sleep(0.2)
    webbrowser.open(URL)


if __name__ == "__main__":
    print("Duet Maker local-engine — 시작 중입니다. 잠시 후 브라우저가 자동으로 열립니다...", flush=True)
    print(f"자동으로 안 열리면 직접 {URL} 을 브라우저 주소창에 입력하세요.", flush=True)
    print("이 창을 닫으면 로컬 엔진이 종료됩니다. 종료하려면 Ctrl+C를 누르세요.", flush=True)
    threading.Thread(target=_open_browser_once_ready, daemon=True).start()
    uvicorn.run(app, host="127.0.0.1", port=8000)

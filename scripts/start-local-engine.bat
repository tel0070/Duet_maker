@echo off
cd /d "%~dp0\..\local-engine"

if not exist "app\main.py" (
  echo [알림] 선택적 로컬 오디오 엔진은 아직 구현되지 않았습니다 ^(Phase 5^).
  echo Harmony Core와 웹 앱의 기본 기능은 로컬 엔진 없이 정상 동작합니다.
  echo local-engine\README.md 에서 현재 상태를 확인하세요.
  exit /b 0
)

if not exist ".venv" (
  echo 가상환경을 생성합니다...
  python -m venv .venv
)

call .venv\Scripts\activate.bat
pip install -r requirements.txt
uvicorn app.main:app --reload

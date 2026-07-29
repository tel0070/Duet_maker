@echo off
setlocal

where node >nul 2>nul
if errorlevel 1 (
  echo [오류] Node.js가 설치되어 있지 않습니다. https://nodejs.org 에서 20 이상 버전을 설치하세요.
  exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo pnpm이 없어 corepack으로 활성화합니다...
  corepack enable
  corepack prepare pnpm@10.33.0 --activate
)

echo 의존성을 설치합니다...
call pnpm install
if errorlevel 1 (
  echo [오류] pnpm install에 실패했습니다.
  exit /b 1
)

echo.
echo 설치가 완료되었습니다.
echo   scripts\start-web.bat       - 웹 앱 개발 서버 실행
echo   scripts\validate-project.bat - lint/typecheck/test/build 전체 검증
endlocal

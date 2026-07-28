@echo off
cd /d "%~dp0\.."
call pnpm --filter @duet-maker/web dev

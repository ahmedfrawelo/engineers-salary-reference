@echo off
setlocal
for %%I in ("%~dp0..") do set "REPO=%%~fI"
set "REPO=%REPO:\=/%"
git -c "safe.directory=%REPO%" %*
set "ERR=%ERRORLEVEL%"
endlocal & exit /b %ERR%

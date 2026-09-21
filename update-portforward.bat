@echo off
title Update WSL2 Port Forwarding
color 0A

echo ========================================
echo    Update WSL2 Port Forwarding
echo ========================================
echo.

echo Updating port forwarding to correct WSL2 IP...
echo Deleting old rule...
netsh interface portproxy delete v4tov4 listenport=3002 listenaddress=0.0.0.0
echo Adding new rule (3002 -^> 172.24.14.93:3002)...
netsh interface portproxy add v4tov4 listenport=3002 listenaddress=0.0.0.0 connectport=3002 connectaddress=172.24.14.93

echo.
echo Verifying new configuration:
echo ----------------------------------------
netsh interface portproxy show v4tov4
echo ----------------------------------------
echo.

echo Configuration updated!
echo External access URL: http://115.190.62.87:3002
echo Forwarding to: 172.24.14.93:3002
echo.
echo Press any key to exit...
pause >nul

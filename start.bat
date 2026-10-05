@echo off
chcp 65001 > nul
title Vietnam Streetfood Game - Dev Environment

echo ========================================================
echo  🏪 KHỞI ĐỘNG PHỐ ẨM THỰC ĐƯỜNG PHỐ VIỆT NAM (DEV)
echo ========================================================
echo.

echo [*] Kiểm tra thư viện server...
if not exist "%~dp0server\node_modules" (
    echo [*] Cài đặt dependencies cho server...
    cd /d "%~dp0server"
    call npm install
    cd /d "%~dp0"
)

echo [*] Đang khởi động Cloud Backend Server (Port 8787)...
start "Cloud Storage Server (Port 8787)" cmd /k "cd /d %~dp0server && npm start"

echo [*] Đang khởi động Web Hub Portal (Port 8080)...
start "Vietnam Street Food Portal (Port 8080)" cmd /k "cd /d %~dp0 && npx serve . -p 8080 -L"

echo.
echo ========================================================
echo  🚀 MỌI THỨ ĐÃ SẴN SÀNG!
echo  - Cổng Game Hub : http://localhost:8080
echo  - Backend Cloud  : http://localhost:8787
echo ========================================================
echo.
timeout /t 2 > nul
start http://localhost:8080

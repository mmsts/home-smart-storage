@echo off
chcp 65001 >nul
echo ========================================
echo   家庭智能储物系统 - 启动服务
echo ========================================
echo.

set "PROJECT_DIR=D:\大三下\智能创意与优化\家庭智能储物系统.3\家庭智能储物系统"
set "NGROK=C:\Users\z3217\AppData\Local\Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe"

echo [1/2] 启动项目服务...
cd /d "%PROJECT_DIR%"
start "项目服务" cmd /k "cd /d "%PROJECT_DIR%" && npm run dev"

echo [2/2] 等待服务启动后启动 ngrok...
timeout /t 10 /nobreak >nul
start "ngrok隧道" cmd /k "cd /d "%PROJECT_DIR%" && "%NGROK%" http https://localhost:5173"

echo.
echo ========================================
echo   启动完成！
echo   电脑访问: https://localhost:5173
echo   ngrok 窗口会显示公网链接（手机用那个）
echo ========================================
pause

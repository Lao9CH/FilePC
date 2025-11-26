@echo off
chcp 65001 >nul
title WebOS 教学系统服务器

echo ================================================================================
echo                    WebOS 教学系统服务器 - 启动程序
echo ================================================================================
echo.
echo 正在启动服务器,请稍候...
echo.

REM 检查是否以管理员身份运行
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [警告] 未检测到管理员权限!
    echo.
    echo 本程序需要管理员权限才能使用80端口。
    echo 请右键点击本文件,选择"以管理员身份运行"。
    echo.
    pause
    exit /b 1
)

REM 检查 web-os-server.exe 是否存在
if not exist "%~dp0web-os-server.exe" (
    echo [错误] 找不到 web-os-server.exe 文件!
    echo 请确保文件完整性。
    echo.
    pause
    exit /b 1
)

REM 启动服务器
echo [信息] 正在启动 WebOS 服务器...
echo.
"%~dp0web-os-server.exe"

REM 如果服务器异常退出
echo.
echo [信息] 服务器已停止运行。
echo.
pause

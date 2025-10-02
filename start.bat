@echo off
cls

echo 微信公众号视频批量上传工具
set NODE_PATH=%~dp0node_modules

if exist "%~dp0node_modules" (
    echo 检测到本地Node.js模块，启动控制器...
    node "%~dp0wechat-mp-puppeteer-controller.js"
) else (
    echo 未检测到Node.js模块，请确保已安装Node.js
    echo 正在尝试直接启动...
    node "%~dp0wechat-mp-puppeteer-controller.js"
)

pause
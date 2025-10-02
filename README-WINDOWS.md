# 微信公众号视频批量上传工具 - Windows部署指南

## 1. 环境准备

在Windows系统上使用本工具，您需要：

- Windows 10/11操作系统
- 已安装Node.js 16.x或更高版本（推荐16.16.0）
- 稳定的网络连接
- Google Chrome浏览器（版本110+）

## 2. 安装步骤

1. **下载项目文件**：
   - 将本项目所有文件复制到Windows电脑上的任意目录
   - 推荐路径：`D:\wechat-video-uploader\`（避免中文路径）

2. **安装依赖**：
   - 打开命令提示符（Win+R，输入cmd回车）
   - 切换到项目目录：`cd /d D:\wechat-video-uploader`
   - 运行命令：`npm install`
   - 等待依赖安装完成

3. **快速启动**：
   - 双击项目目录中的 `start.bat` 文件
   - 或在命令提示符中运行：`start.bat`

## 3. 使用方法

1. **启动工具**：运行 `start.bat` 后，控制器会自动启动

2. **账号管理**：
   - 工具会自动打开账号管理界面
   - 添加或选择微信公众号账号

3. **上传视频**：
   - 在微信公众号后台导航到「素材管理」-「视频」页面
   - 控制器会自动检测页面并创建操作面板
   - 点击「选择视频目录」按钮，选择包含视频文件的文件夹
   - 系统会自动识别同名的PNG文件作为视频封面

4. **自动封面匹配规则**：
   - 例如：`video1.mp4` 会自动匹配 `video1.png` 作为封面
   - 支持批量上传多个视频文件

## 4. 文件结构说明

- `wechat-mp-puppeteer-controller.js` - 主控制器文件
- `wechat-video-uploader.js` - 上传核心功能
- `chrome-debug-uploader.js` - Chrome调试模式上传逻辑
- `wechat-mp-auto-injector.js` - 浏览器注入脚本
- `start.bat` - Windows启动脚本
- `index.html` - 界面文件
- `icon.svg` - 应用图标

## 5. 常见问题

### 5.1 依赖安装失败
- 确保Node.js版本正确
- 尝试使用淘宝镜像：`npm install --registry=https://registry.npmmirror.com`

### 5.2 浏览器无法启动
- 确保Chrome浏览器已安装且版本兼容
- 检查用户数据目录权限

### 5.3 封面上传失败
- 确保封面文件为PNG格式
- 文件名必须与视频文件完全相同（除扩展名外）
- 封面尺寸建议为：1280x720像素

## 6. 注意事项

- 使用过程中请保持网络连接稳定
- 首次使用时需要手动登录微信公众号
- 上传过程中请勿关闭命令提示符窗口
- 按Enter键可以退出程序

## 7. 批量打包说明

本项目提供了两种在Windows上运行的方式：

1. **轻量方式**：直接运行 `start.bat`，适合快速使用
2. **独立方式**：如需创建独立可执行文件，在Windows环境下执行：
   ```
   npm install -g pkg
   pkg wechat-mp-puppeteer-controller.js --targets node16-win-x64 --output wechat-video-uploader.exe
   ```

## 8. 联系方式

如有问题或建议，请随时反馈。
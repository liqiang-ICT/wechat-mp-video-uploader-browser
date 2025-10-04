# 微信公众号视频批量上传工具 - Node.js 版本使用指南

## 项目概述

这是一个基于 Node.js 和 Puppeteer 的微信公众号视频批量上传工具，可以帮助用户自动完成微信公众号后台的视频素材上传工作。

## 打包文件说明

通过 Webpack 打包后，所有必要的文件都位于 `dist` 目录中：

- `wechat-mp-puppeteer-controller.bundle.js` - 核心控制器（打包后的主程序）
- `account-manager.bundle.js` - 账号管理模块（打包后的）
- `chrome-debug-uploader.js` - 视频上传注入脚本
- `chrome-debug-tag.js` - 调试标签脚本
- `wechat-mp-auto-injector.js` - 自动注入脚本
- `chrome-debug-video-batch-delete-pure.js` - 视频批量删除脚本
- `account-manager.html` - 账号管理页面
- `index.html` - 首页

## 使用方法

### 方法一：直接运行打包后的文件（推荐）

1. 确保已安装 Node.js 环境（推荐 v16+）

2. 安装项目依赖：
   ```bash
   npm install
   ```

3. 使用我们提供的启动脚本来运行打包后的应用：
   ```bash
   npm run start:bundle
   ```
   或者直接运行：
   ```bash
   node start.js
   ```

### 方法二：直接运行源代码

如果需要修改代码或者调试，可以直接运行源代码：

```bash
npm start
```
或者：
```bash
node wechat-mp-puppeteer-controller.js
```

### 方法三：在其他 Node.js 项目中引用

你也可以在其他 Node.js 项目中引用打包后的模块：

```javascript
const controller = require('./dist/wechat-mp-puppeteer-controller.bundle.js');
// 使用 controller 中的功能
```

## 开发与构建

### 构建项目

如果你修改了源代码，需要重新构建：

```bash
npm run build
```

### 开发模式

在开发过程中，可以使用监视模式，实时编译修改：

```bash
npm run dev
```

## 功能说明

1. **账号管理**：支持多账号管理和切换
2. **自动登录**：自动打开浏览器并引导用户扫码登录
3. **视频批量上传**：自动选择视频文件并上传到微信公众号后台
4. **状态监控**：实时监控上传进度和状态

## 注意事项

1. 首次运行时，会自动下载 Puppeteer 所需的 Chrome 浏览器，可能需要一些时间
2. 请确保网络连接稳定，特别是在视频上传过程中
3. 微信公众号后台可能会不定期更新，如遇到无法正常工作的情况，请更新相关脚本
4. 请遵守微信公众平台的使用规范，合理使用自动化工具

## 常见问题

**Q: 启动时提示找不到某个文件？**
A: 请确保执行了 `npm run build` 命令，生成了所有必要的打包文件。

**Q: 浏览器启动失败？**
A: 请检查 Puppeteer 依赖是否正确安装，或尝试手动指定 Chrome 浏览器路径。

**Q: 上传过程中断？**
A: 可能是网络问题或微信公众号后台限制，请检查网络连接并重试。

## 版本历史

- v1.0.0: 初始版本，支持基本的视频批量上传功能

## 许可证

MIT License
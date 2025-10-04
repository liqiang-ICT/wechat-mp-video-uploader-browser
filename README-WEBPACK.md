# 微信公众号视频批量上传工具 - Webpack打包版本

本文档介绍了使用Webpack打包后的微信公众号视频批量上传工具的使用方法和相关信息。

## 打包文件说明

本工具通过Webpack打包后生成了两类文件，分别用于浏览器端和Node.js端：

### 浏览器端打包文件 (在dist/browser/目录下)

- **chrome-debug-uploader.bundle.js**: 用于Chrome开发者工具的视频上传脚本
- **chrome-debug-tag.bundle.js**: 用于Chrome开发者工具的标签处理脚本
- **wechat-mp-auto-injector.bundle.js**: 用于微信公众号页面的自动注入脚本

### Node.js端打包文件 (在dist/node/目录下)

- **wechat-video-uploader.bundle.js**: 用于Node.js环境的视频上传主程序
- **wechat-mp-puppeteer-controller.bundle.js**: Node.js环境的Puppeteer控制器
- **main.bundle.js**: 主程序入口文件

## 使用方法

### 1. 浏览器端使用方法

#### Chrome开发者工具中使用

1. 打开Chrome浏览器，访问微信公众号后台
2. 按F12打开开发者工具
3. 切换到Console选项卡
4. 复制对应bundle.js文件的内容，粘贴到控制台中执行
5. 按照提示操作进行视频上传

#### 作为书签工具使用

1. 在Chrome浏览器中创建一个新书签
2. 在URL字段中输入：`javascript:(function(){/* 粘贴bundle.js文件内容 */})()`
3. 保存书签
4. 访问微信公众号后台页面，点击该书签运行脚本

#### Chrome扩展方式使用

1. 创建一个新文件夹作为扩展目录
2. 在目录中创建manifest.json文件，配置如下：
   ```json
   {
     "manifest_version": 2,
     "name": "微信公众号视频批量上传",
     "version": "1.0",
     "description": "用于微信公众号视频批量上传的Chrome扩展",
     "content_scripts": [
       {
         "matches": ["*://mp.weixin.qq.com/*"],
         "js": ["chrome-debug-uploader.bundle.js", "chrome-debug-tag.bundle.js"]
       }
     ],
     "permissions": ["activeTab"]
   }
   ```
3. 将对应的bundle.js文件复制到扩展目录
4. 打开Chrome扩展页面（chrome://extensions）
5. 开启开发者模式
6. 点击"加载已解压的扩展程序"，选择创建的扩展目录

### 2. Node.js端使用方法

#### 直接运行打包文件

```bash
node dist/node/wechat-video-uploader.bundle.js
```

或者使用package.json中定义的脚本：

```bash
npm run start:node-bundle
```

#### 在其他Node.js项目中引用

```javascript
// 引入打包后的模块
const WechatVideoUploader = require('./path/to/dist/node/wechat-video-uploader.bundle.js');

// 使用模块功能
```

## 开发和构建

### 安装依赖

```bash
npm install
npm install --save-dev webpack webpack-cli babel-loader @babel/core @babel/preset-env
```

### 构建命令

- **构建浏览器端**: `npm run build:web`
- **构建Node.js端**: `npm run build:node`
- **构建所有版本**: `npm run build:all`

## 功能说明

1. **视频批量上传**: 支持批量选择视频文件并自动上传到微信公众号
2. **封面匹配**: 自动匹配视频对应的封面图片
3. **文件名规范化**: 自动处理文件名末尾的"(x)"格式数字标识
4. **标签管理**: 支持视频标签的批量添加和编辑

## 注意事项

1. 使用Node.js版本时，需要确保已安装puppeteer依赖
2. 浏览器端使用时，需确保在微信公众号后台页面执行
3. 使用过程中可能需要扫码登录微信公众号
4. 上传视频大小受微信公众号限制，过大的视频可能无法上传
5. 请遵守微信公众平台的相关规定，不要滥用工具进行违规操作

## 版本历史

### 1.0.0
- 初始版本发布
- 支持浏览器端和Node.js端打包
- 提供多种使用方式
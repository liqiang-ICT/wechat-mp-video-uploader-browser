// 启动脚本 - 运行打包后的微信公众号视频上传控制器

const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('微信公众号视频批量上传工具 - 启动脚本');
console.log('========================================');
console.log();

// 确定当前工作目录
const cwd = process.cwd();
console.log(`当前工作目录: ${cwd}`);

// 控制器文件路径
const bundledControllerPath = path.join(cwd, 'dist', 'wechat-mp-puppeteer-controller.js');
const sourceControllerPath = path.join(cwd, 'wechat-mp-puppeteer-controller.js');

// 启动控制器
async function startController() {
  try {
    // 优先尝试运行打包后的控制器
    if (fs.existsSync(bundledControllerPath)) {
      console.log('启动打包后的控制器...');
      console.log(`控制器路径: ${bundledControllerPath}`);
      
      // 直接执行控制器文件，不检查run方法（压缩后的代码可能直接执行）
      require(bundledControllerPath);
    } else if (fs.existsSync(sourceControllerPath)) {
      console.log('未找到打包后的控制器，启动源代码控制器...');
      console.log(`控制器路径: ${sourceControllerPath}`);
      
      // 导入源代码控制器
      require(sourceControllerPath);
    } else {
      console.error('错误: 找不到控制器文件');
      console.error(`检查以下路径是否存在:`);
      console.error(`- ${bundledControllerPath}`);
      console.error(`- ${sourceControllerPath}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('启动控制器时发生错误:', error);
    
    // 记录错误到日志文件
    try {
      const errorLogPath = path.join(cwd, 'error.log');
      const errorMessage = `[${new Date().toISOString()}] 启动错误: ${error.stack || error.message}\n`;
      fs.appendFileSync(errorLogPath, errorMessage, 'utf8');
      console.log(`错误已记录到: ${errorLogPath}`);
    } catch (logError) {
      console.error('记录错误日志失败:', logError);
    }
    
    process.exit(1);
  }
}

// 启动应用
startController();
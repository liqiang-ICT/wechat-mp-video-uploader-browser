const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    
    // 启动控制器脚本
    startController();
}

function startController() {
    try {
        const controller = spawn('node', [path.join(__dirname, 'wechat-mp-puppeteer-controller.js')], {
            stdio: 'inherit'
        });

        controller.on('close', (code) => {
            console.log(`控制器退出，代码 ${code}`);
        });

        controller.on('error', (err) => {
            console.error('启动控制器失败:', err);
        });
    } catch (error) {
        console.error('启动控制器出错:', error);
    }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
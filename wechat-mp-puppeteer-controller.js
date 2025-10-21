const path = require('path');
const readline = require('readline');
const puppeteer = require('puppeteer');
const fs = require('fs');
const os = require('os');

// 引入账号管理模块
const accountManager = require('./account-manager');

// 配置信息
const config = {
    headless: false, // 是否无头模式，开发阶段设为false便于调试
    delayBetweenActions: 3000, // 操作间隔时间(毫秒)
    maxRetries: 3, // 失败重试次数
    timeout: 60000, // 操作超时时间(毫秒)
    logFile: path.join(__dirname, 'wechat-mp-auto-controller.log'), // 日志文件路径
    userDataDir: path.join(__dirname, 'user-data') // 浏览器用户数据目录，用于保存登录状态
};

// 获取系统Chrome路径
const getSystemChromePath = () => {
    const platform = os.platform();
    if (platform === 'darwin') { // macOS
        return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    } else if (platform === 'win32') { // Windows
        return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    } else if (platform === 'linux') { // Linux
        return '/usr/bin/google-chrome';
    }
    return ''; // 默认返回空
};

// 保存日志到文件
const saveLogToFile = (message) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    
    try {
        fs.appendFileSync(config.logFile, logEntry, 'utf8');
    } catch (error) {
        console.error(`无法写入日志文件: ${error.message}`);
    }
};

// 存储登录后的token
let WECHAT_MP_TOKEN = '';

// 全局浏览器实例
let globalBrowser = null;

// 当前活跃的账号页面映射
let activeAccountPages = new Map();

// 日志记录
const log = (message) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    console.log(logEntry);
    saveLogToFile(message);
};

// 等待函数
const wait = (ms) => new Promise(r => setTimeout(r, ms));

// 等待用户扫码登录
const waitForLogin = async (page) => {
    log('请在浏览器中扫码登录微信公众号...');
    
    // 等待页面跳转（最多等待2分钟）
    try {
        log('等待页面跳转以获取登录状态...');
        await page.waitForNavigation({
            waitUntil: 'networkidle0',
            timeout: 120000 // 2分钟超时
        });
        
        // 获取URL中的token参数
        const currentUrl = page.url();
        const tokenMatch = currentUrl.match(/token=([^&]+)/);
        if (tokenMatch && tokenMatch[1]) {
            WECHAT_MP_TOKEN = tokenMatch[1];
            log(`成功获取token: ${WECHAT_MP_TOKEN}`);
            log('登录成功！');
            return true;
        }
    } catch (e) {
        log(`等待页面跳转超时: ${e.message}`);
    }
    
    // 检查页面内容是否表示已登录
    log('检查页面内容以确定登录状态...');
    let isLoggedIn = false;
    
    try {
        // 检查页面是否仍然有效
        if (!page.isClosed()) {
            isLoggedIn = await page.evaluate(() => {
                // 检查页面是否包含表示已登录的元素或文本
                const loggedInIndicators = [
                    '首页',
                    '素材管理',
                    '内容创作',
                    '已登录',
                    '我的账号'
                ];
                
                // 确保document存在
                if (!document || !document.body) {
                    return false;
                }
                
                const pageContent = document.body.textContent.toLowerCase();
                return loggedInIndicators.some(indicator => pageContent.includes(indicator.toLowerCase()));
            });
        } else {
            log('警告：页面已关闭，无法检查登录状态');
            return false;
        }
    } catch (e) {
        log(`检查登录状态时出错: ${e.message}`);
        // 如果是Frame已分离的错误，尝试重新获取当前页面状态
        if (e.message && e.message.includes('detached Frame')) {
            log('检测到Frame已分离，尝试通过URL检查登录状态...');
            const currentUrl = page.url();
            // 简单地通过URL是否包含token来判断登录状态
            if (currentUrl.includes('token=')) {
                const tokenMatch = currentUrl.match(/token=([^&]+)/);
                if (tokenMatch && tokenMatch[1]) {
                    WECHAT_MP_TOKEN = tokenMatch[1];
                    log(`成功获取token: ${WECHAT_MP_TOKEN}`);
                }
                log('登录成功！');
                return true;
            }
        }
        return false;
    }
    
    if (isLoggedIn) {
        // 尝试从当前URL获取token
        const currentUrl = page.url();
        const tokenMatch = currentUrl.match(/token=([^&]+)/);
        if (tokenMatch && tokenMatch[1]) {
            WECHAT_MP_TOKEN = tokenMatch[1];
            log(`成功获取token: ${WECHAT_MP_TOKEN}`);
        }
        log('登录成功！');
        return true;
    } else {
        log('警告：未能确认登录状态。如果您已经登录，请刷新页面并重试。');
        return false;
    }
};

// 为页面添加事件监听器
const setupPageListeners = async (page) => {
    // 初始检查
    await checkAndProcessPage(page);
    
    // 监听页面导航事件
    page.on('framenavigated', async () => {
        log('检测到页面框架导航事件');
        await checkAndProcessPage(page);
    });
    
    // 监听页面加载完成事件
    page.on('load', async () => {
        log('检测到页面加载完成事件');
        await checkAndProcessPage(page);
    });
    
    // 监听DOM内容加载完成事件
    page.on('domcontentloaded', async () => {
        log('检测到DOM内容加载完成事件');
        // 延迟一小段时间确保页面完全渲染
        await wait(500);
        await checkAndProcessPage(page);
    });
    
    /*
    // 添加定时检查作为备用机制，每5秒检查一次
    const periodicCheck = async () => {
        while (true) {
            try {
                await wait(5000); // 每5秒检查一次
                // 检查页面是否已关闭
                if (!page.isClosed()) {
                    // 只有在事件监听可能没有触发的情况下才执行检查
                    await page.evaluate(() => {
                        if (!window.lastCheckedTime || Date.now() - window.lastCheckedTime > 10000) {
                            window.lastCheckedTime = Date.now();
                            return true;
                        }
                        return false;
                    }).then(async (shouldCheck) => {
                        if (shouldCheck) {
                            log('执行定时页面检查');
                            await checkAndProcessPage(page);
                        }
                    }).catch(error => {
                        // 忽略页面已关闭的错误
                        if (!error.message.includes('Page closed')) {
                            log(`定时页面检查出错: ${error.message}`);
                        }
                    });
                } else {
                    break; // 页面已关闭，停止检查
                }
            } catch (error) {
                // 忽略页面已关闭的错误
                if (!error.message.includes('Page closed')) {
                    log(`定时页面检查出错: ${error.message}`);
                } else {
                    break; // 页面已关闭，停止检查
                }
            }
        }
    };
    
    // 启动定时检查
    periodicCheck();
    */
};

// 监测页面URL变化和新标签页创建
const monitorPageUrl = async (page, browser) => {
    log('开始监测页面URL变化和新标签页创建...');
    
    // 为初始页面添加监听器
    await setupPageListeners(page);
    
    // 监听新标签页创建事件
    browser.on('targetcreated', async (target) => {
        try {
            // 只处理页面类型的目标
            if (target.type() === 'page') {
                log('检测到新标签页创建');
                const newPage = await target.page();
                if (newPage) {
                    // 等待页面加载完成
                    await newPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {
                        log('新标签页导航等待超时，继续执行');
                    });
                    
                    // 为新标签页添加监听器
                    log('为新标签页设置事件监听器');
                    await setupPageListeners(newPage);
                }
            }
        } catch (error) {
            log(`处理新标签页时出错: ${error.message}`);
        }
    });
    
    // 等待用户退出
    await new Promise(resolve => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        log('按Enter键退出程序...');
        rl.on('line', () => {
            log('程序退出中...');
            rl.close();
            globalBrowser.close().then(resolve);
        });
    });
};

// 检查页面URL并执行相应操作
const checkAndProcessPage = async (page) => {
    const currentUrl = page.url();
    log(`当前页面URL: ${currentUrl}`);
    
    // 在页面上设置最后检查时间
    await page.evaluate(() => {
        window.lastCheckedTime = Date.now();
    });
    
    // 检查是否为视频素材管理页
    if (currentUrl.includes('cgi-bin/appmsg') && currentUrl.includes('action=list_video')) {
        log('检测到视频素材管理页，准备执行视频批量上传功能...');
        await injectAndExecuteUploaderScript(page);
    }
    // 检查是否为用户管理页
    else if (currentUrl.includes('cgi-bin/user_tag') && currentUrl.includes('action=get_all_data')) {
        log('检测到用户管理页，准备执行用户批量打标签功能...');
        await injectAndExecuteTagScript(page);
    }
    // 检查是否为视频配置页面（新打开的配置页面）
    else if (currentUrl.includes('cgi-bin/appmsg') && currentUrl.includes('t=media/appmsg_edit_v2') && currentUrl.includes('action=edit')) {
        log('检测到视频配置页面，准备执行自动配置功能...');
        await injectAndExecuteConfigAutoScript(page);
    }
    // 检查是否为登录页
    else if (currentUrl.includes('mp.weixin.qq.com') && currentUrl.includes('cgi-bin/login')) {
        log('当前为登录页，请登录后继续');
    }
    // 检查是否为素材管理编辑页
    else if (currentUrl.includes('videomsg_edit')) {
        log('当前为素材管理编辑页');
    }
    // 其他页面，清除可能的注入标记，以便在导航到目标页面时重新注入
    else {
        log('当前为其他页面，清除注入标记');
        await page.evaluate(() => {
            // 清除注入标记，以便在导航到目标页面时重新注入
            window.chromeDebugUploaderInjected = false;
            window.chromeDebugTagInjected = false;
            window.chromeDebugConfigAutoInjected = false;
        });
    }
};

// 注入并执行视频配置自动操作脚本
const injectAndExecuteConfigAutoScript = async (page) => {
    const pageInstanceId = `config-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    log(`准备注入视频配置自动脚本 - 页面ID: ${pageInstanceId}`);
    
    try {
        // 检查当前页面是否适合注入脚本
        const currentUrl = page.url();
        if (!currentUrl.includes('cgi-bin/appmsg') || 
            !currentUrl.includes('t=media/appmsg_edit_v2') || 
            !currentUrl.includes('action=edit')) {
            log(`跳过注入 - 非视频配置页面: ${currentUrl}`);
            return;
        }
        
        // 检查是否已经注入过脚本
        const isInjected = await page.evaluate(() => {
            return window.chromeDebugConfigAutoInjected || false;
        });
        
        if (isInjected) {
            log('视频配置自动操作脚本在其他页面已经注入过');
            //return;
        }

        log('准备注入视频配置自动操作脚本...');
        
        // 读取chrome-debug-config-auto.js文件内容
        const scriptPath = path.join(__dirname, 'chrome-debug-config-auto.js');
        if (!fs.existsSync(scriptPath)) {
            throw new Error(`找不到视频配置自动操作脚本文件: ${scriptPath}`);
        }
        
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');
        
        // 注入页面实例ID
        await page.evaluate((id) => {
            window._configPageInstanceId = id;
        }, pageInstanceId);
        
        // 注入脚本
        await page.evaluate(scriptContent => {
            // 将脚本内容注入到页面
            const script = document.createElement('script');
            script.textContent = scriptContent;
            document.head.appendChild(script);
            
            // 设置注入标记
            window.chromeDebugConfigAutoInjected = true;
        }, scriptContent);
        
        log('视频配置自动操作脚本注入成功！');
        log('脚本将自动执行以下操作：');
        log('1. 点击留言配置按钮并确认');
        log('2. 点击声明按钮，选择"内容来自AI"，点击确认');
        log('3. 点击保存按钮完成配置');
        
        // 监控配置完成状态并安全关闭页面
        monitorConfigCompletionAndClose(page, pageInstanceId);
        
    } catch (error) {
        log(`注入视频配置自动操作脚本失败: ${error.message}`);
        // 输出更详细的错误堆栈
        if (error.stack) {
            console.error(error.stack);
        }
    }
};

/**
 * 监控配置完成状态并安全关闭页面
 */
async function monitorConfigCompletionAndClose(page, pageInstanceId) {
    try {
        // 设置最大等待时间为60秒
        const maxWaitTime = 60000;
        const checkInterval = 1000; // 每秒检查一次
        let elapsedTime = 0;
        
        log(`开始监控配置完成状态 - 页面ID: ${pageInstanceId}`);
        
        // 轮询检查配置是否完成
        while (elapsedTime < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            elapsedTime += checkInterval;
            
            try {
                // 检查配置是否完成
                const isConfigCompleted = await page.evaluate(() => {
                    return window._configAutoCompleted === true;
                });
                
                if (isConfigCompleted) {
                    log(`检测到配置已完成，等待2秒后安全关闭页面 - 页面ID: ${pageInstanceId}`);
                    
                    // 等待2秒确保所有保存操作完成
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // 使用Puppeteer的page.close()方法安全关闭页面
                    // 设置waitUntil: 'networkidle0'确保网络活动完成
                    await page.close({
                        waitUntil: 'networkidle0',
                        timeout: 10000
                    });
                    
                    log(`页面已安全关闭 - 页面ID: ${pageInstanceId}`);
                    return;
                }
            } catch (checkError) {
                // 如果页面已经关闭或其他错误，直接返回
                log(`监控过程中遇到错误，可能页面已关闭 - 页面ID: ${pageInstanceId}`);
                return;
            }
        }
        
        log(`监控超时，页面未完成配置 - 页面ID: ${pageInstanceId}`);
    } catch (error) {
        log(`监控配置完成状态时出错: ${error.message}`);
    }
}

// 注入并执行视频上传脚本
const injectAndExecuteUploaderScript = async (page) => {
    try {
        // 检查当前页面是否适合注入脚本
        const currentUrl = page.url();
        if (!currentUrl.includes('cgi-bin/appmsg') || !currentUrl.includes('action=list_video')) {
            log('警告：当前页面不适合注入视频上传脚本，跳过注入');
            return;
        }
        
        log('准备注入视频上传脚本...');
        
        // 读取chrome-debug-uploader.js文件内容
        const scriptPath = path.join(__dirname, 'chrome-debug-uploader.js');
        if (!fs.existsSync(scriptPath)) {
            throw new Error(`找不到视频上传脚本文件: ${scriptPath}`);
        }
        
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');
        
        // 注入脚本
        await page.evaluate(scriptContent => {
            // 将脚本内容注入到页面
            const script = document.createElement('script');
            script.textContent = scriptContent;
            document.head.appendChild(script);
        }, scriptContent);
        
        log('视频上传脚本注入成功！');
        
    } catch (error) {
        log(`注入视频上传脚本失败: ${error.message}`);
    }
};

// 注入并执行用户标签脚本
const injectAndExecuteTagScript = async (page) => {
    try {
        // 检查当前页面是否适合注入脚本
        const currentUrl = page.url();
        if (!currentUrl.includes('cgi-bin/user_tag') || !currentUrl.includes('action=get_all_data')) {
            log('警告：当前页面不适合注入用户标签脚本，跳过注入');
            return;
        }
        
        log('准备注入用户标签脚本...');
        
        // 读取chrome-debug-tag.js文件内容
        const scriptPath = path.join(__dirname, 'chrome-debug-tag.js');
        if (!fs.existsSync(scriptPath)) {
            throw new Error(`找不到用户标签脚本文件: ${scriptPath}`);
        }
        
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');
        
        // 注入脚本
        await page.evaluate(scriptContent => {
            // 将脚本内容注入到页面
            const script = document.createElement('script');
            script.textContent = scriptContent;
            document.head.appendChild(script);
        }, scriptContent);
        
        log('批量打标签按钮脚本已注入，请点击按钮开始操作');
        
    } catch (error) {
        log(`注入用户标签脚本失败: ${error.message}`);
    }
};

// 获取视频文件列表
const getVideoFiles = (dir) => {
    try {
        // 清理路径，将Windows路径格式转换为当前系统格式
        let cleanDir = dir;
        if (os.platform() !== 'win32') {
            // 将Windows的反斜杠转换为正斜杠
            cleanDir = dir.replace(/\\/g, '/');
        }
        
        if (!fs.existsSync(cleanDir)) {
            log(`警告：视频目录不存在: ${cleanDir}`);
            return [];
        }
        
        const files = fs.readdirSync(cleanDir)
            .filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ['.mp4', '.mov', '.avi', '.flv', '.wmv', '.mkv'].includes(ext);
            })
            .map(file => path.join(cleanDir, file));
            
        log(`在目录 ${cleanDir} 中找到 ${files.length} 个视频文件`);
        
        return files;
    } catch (error) {
        log(`获取视频文件列表时出错: ${error.message}`);
        return [];
    }
};

// 自动重试函数
const withRetry = async (operation, operationName, maxRetries = config.maxRetries) => {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            log(`尝试执行${operationName} (第${attempt}/${maxRetries}次尝试)`);
            const result = await operation();
            log(`${operationName}执行成功`);
            return result;
        } catch (error) {
            lastError = error;
            log(`尝试${attempt}执行${operationName}失败: ${error.message}`);
            
            if (attempt < maxRetries) {
                log(`等待${config.delayBetweenActions}毫秒后重试...`);
                await wait(config.delayBetweenActions);
            }
        }
    }
    
    throw new Error(`${operationName}在${maxRetries}次尝试后仍然失败: ${lastError?.message || '未知错误'}`);
};

// 解析命令行参数
function parseCommandLineArgs() {
    const args = process.argv.slice(2);
    const options = {
        action: 'manage', // 默认操作：账号管理
        accountId: null
    };
    
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--action' && i + 1 < args.length) {
            options.action = args[i + 1];
            i++;
        } else if (args[i] === '--accountId' && i + 1 < args.length) {
            options.accountId = args[i + 1];
            i++;
        }
    }
    
    return options;
}

// 启动账号管理页面
const startAccountManager = async () => {
    log('启动账号管理页面...');
    
    try {
        // 获取系统Chrome路径
        const chromePath = getSystemChromePath();
        
        // 检查是否已有全局浏览器实例，如果没有则创建
        if (!globalBrowser || !globalBrowser.isConnected()) {
            globalBrowser = await puppeteer.launch({
                headless: false,
                defaultViewport: null,
                args: ['--start-maximized'],
                executablePath: chromePath || undefined,
                timeout: config.timeout, // 浏览器启动超时时间
                slowMo: 100 // 添加适当的延迟，避免操作过快导致的问题
            });
            
            // 监听浏览器关闭事件
            globalBrowser.on('disconnected', () => {
                log('浏览器已关闭');
                globalBrowser = null;
                activeAccountPages.clear();
            });
        }
        
        // 在现有的浏览器实例中创建新标签页
        const page = await globalBrowser.newPage();
        
        // 读取账号管理页面内容
        const accountManagerHtmlPath = path.join(__dirname, 'account-manager.html');
        const htmlContent = fs.readFileSync(accountManagerHtmlPath, 'utf8');
        
        // 获取所有账号数据
        const accounts = accountManager.getAllAccounts();
        
        // 保存修改后的HTML到临时文件
        const tempHtmlPath = path.join(__dirname, 'temp-account-manager.html');
        fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');
        
        // 保存账号管理页面的引用
        const accountManagerPage = page;
        
        // 注入账号数据到页面全局变量
        await accountManagerPage.evaluate((accountsData) => {
            window.__ACCOUNTS__ = accountsData;
        }, accounts);
        
        // 保存到全局变量以便deleteAccount函数使用
        global.accountManagerPage = accountManagerPage;
        
        // 注入addNewAccount函数到浏览器窗口对象
        await page.exposeFunction('addNewAccount', async () => {
            try {
                // 在同一个浏览器中添加新账号
                await addNewAccount();
                
                // 添加完成后刷新账号列表
                if (accountManagerPage && !accountManagerPage.isClosed()) {
                    try {
                        await accountManagerPage.evaluate(() => {
                            if (typeof window.refreshAccountsList === 'function') {
                                window.refreshAccountsList();
                            }
                        });
                    } catch (evalError) {
                        log(`刷新账号列表时出错: ${evalError.message}`);
                    }
                }
            } catch (error) {
                log(`添加账号过程中出错: ${error.message}`);
                console.error(error);
            }
        });
        
        // 注入switchToAccount函数到浏览器窗口对象
        await page.exposeFunction('switchToAccount', async (accountId) => {
            try {
                // 在同一个浏览器中切换到选中账号
                await handleAction('switch-account', accountId);
            } catch (error) {
                log(`切换账号过程中出错: ${error.message}`);
                console.error(error);
            }
        });
        
        // 注入deleteAccount函数到浏览器窗口对象
        await page.exposeFunction('deleteAccount', async (accountId) => {
            try {
                log(`前端触发删除账号: ${accountId}`);
                console.log(`后端接收到删除账号请求，账号ID: ${accountId}`);
                
                // 检查参数有效性
                if (!accountId || typeof accountId !== 'string') {
                    throw new Error(`无效的账号ID: ${accountId}`);
                }
                
                // 打印当前活跃账号页面信息
                console.log(`当前活跃账号数量: ${activeAccountPages.size}`);
                
                // 删除账号
                console.log(`准备调用handleAction删除账号`);
                await handleAction('delete-account', accountId);
                console.log(`handleAction删除账号完成`);
                
                // 删除完成后刷新账号列表
                console.log(`准备刷新账号列表`);
                if (global.accountManagerPage && !global.accountManagerPage.isClosed()) {
                    console.log(`账号管理页面有效，尝试刷新列表`);
                    try {
                        // 先获取最新的账号数据
                        const updatedAccounts = accountManager.getAllAccounts();
                        
                        // 重新注入账号数据到页面全局变量
                        await global.accountManagerPage.evaluate((accountsData) => {
                            window.__ACCOUNTS__ = accountsData;
                            console.log('重新注入账号数据:', accountsData);
                        }, updatedAccounts);
                        
                        // 然后刷新账号列表
                        await global.accountManagerPage.evaluate(() => {
                            console.log('执行前端refreshAccountsList函数');
                            if (typeof window.refreshAccountsList === 'function') {
                                window.refreshAccountsList();
                            } else {
                                console.error('window.refreshAccountsList函数不存在');
                            }
                        });
                        console.log(`账号列表刷新完成`);
                    } catch (evalError) {
                        log(`刷新账号列表时出错: ${evalError.message}`);
                        console.error('刷新账号列表错误:', evalError);
                    }
                } else {
                    console.log('账号管理页面已关闭或无效，无法刷新列表');
                }
            } catch (error) {
                log(`删除账号过程中出错: ${error.message}`);
                console.error('删除账号错误:', error);
                // 将错误信息传递回前端
                throw error;
            }
        });
        
        // 注入getLatestAccounts函数到浏览器窗口对象，用于获取最新的账号数据
        await page.exposeFunction('getLatestAccounts', async () => {
            try {
                log('前端请求获取最新账号数据');
                // 直接从文件系统重新读取最新的账号数据
                const latestAccounts = accountManager.getAllAccounts();
                log(`成功获取最新账号数据，共${latestAccounts.length}个账号`);
                return latestAccounts;
            } catch (error) {
                log(`获取最新账号数据失败: ${error.message}`);
                console.error('获取最新账号数据错误:', error);
                // 返回空数组避免前端出错
                return [];
            }
        });
        
        // 打开账号管理页面
        await page.goto(`file://${tempHtmlPath}`, { timeout: config.timeout });
        
        // 页面加载后，设置window.__ACCOUNTS__变量，让前端页面能够访问到账号数据
        await page.evaluate((accountsData) => {
            window.__ACCOUNTS__ = accountsData;
            // 刷新账号列表
            if (typeof window.refreshAccountsList === 'function') {
                window.refreshAccountsList();
            }
        }, accounts);
        
        // 自定义等待函数，等待用户关闭浏览器或超时
        const waitForBrowserClose = (browser, timeoutMs) => {
            return new Promise((resolve) => {
                const startTime = Date.now();
                const checkInterval = setInterval(() => {
                    // 检查是否超时
                    if (Date.now() - startTime > timeoutMs) {
                        clearInterval(checkInterval);
                        log('等待浏览器关闭超时');
                        resolve();
                    }
                    // 检查浏览器是否已关闭
                    try {
                        const targets = globalBrowser.targets();
                        // 如果没有活跃的页面目标，认为浏览器已关闭
                        const hasActivePages = targets.some(target => 
                            target.type() === 'page' && target.url() !== 'about:blank'
                        );
                        if (!hasActivePages) {
                            clearInterval(checkInterval);
                            resolve();
                        }
                    } catch (error) {
                        // 如果访问globalBrowser.targets()出错，可能是浏览器已关闭
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 1000); // 每秒检查一次
            });
        };
        
        // 等待用户关闭浏览器，设置一个较长的超时时间
        await waitForBrowserClose(globalBrowser, 3600000); // 1小时超时
        
        // 删除临时文件
        try {
            fs.unlinkSync(tempHtmlPath);
        } catch (error) {
            log(`警告：无法删除临时文件: ${error.message}`);
        }
        
    } catch (error) {
        log(`启动账号管理页面失败: ${error.message}`);
        console.error(error);
    }
};

// 处理命令行操作
const handleAction = async (action, accountId) => {
    switch (action) {
        case 'manage':
            log('微信公众号自动控制器启动 - 账号管理模式');
            await startAccountManager();
            break;
            
        case 'add-account':
            log('微信公众号自动控制器启动 - 添加新账号模式');
            await addNewAccount();
            break;
            
        case 'switch-account':
            if (!accountId) {
                log('错误：切换账号时需要提供账号ID');
                return;
            }
            log(`微信公众号自动控制器启动 - 切换到账号: ${accountId}`);
            await switchToAccount(accountId);
            break;
            
        case 'delete-account':
            if (!accountId) {
                log('错误：删除账号时需要提供账号ID');
                return;
            }
            log(`删除账号: ${accountId}`);
            const success = accountManager.deleteAccount(accountId);
            if (success) {
                log('账号删除成功');
                // 从活跃账号页面映射中移除对应的页面引用
                if (activeAccountPages.has(accountId)) {
                    try {
                        const accountPageInfo = activeAccountPages.get(accountId);
                        if (accountPageInfo && accountPageInfo.page && !accountPageInfo.page.isClosed()) {
                            await accountPageInfo.page.close();
                        }
                        activeAccountPages.delete(accountId);
                        log(`已关闭并移除账号 ${accountId} 的页面引用`);
                    } catch (e) {
                        log(`清理账号页面引用时出错: ${e.message}`);
                    }
                }
            } else {
                log('账号删除失败');
            }
            // 延迟退出，让用户看到结果
            await wait(2000);
            break;
            
        default:
            log(`未知操作: ${action}`);
            log('可用操作: manage, add-account, switch-account, delete-account');
    }
};

// 添加新账号
const addNewAccount = async () => {
    try {
        // 获取系统Chrome路径
        const chromePath = getSystemChromePath();
        if (!chromePath) {
            log('警告：未能自动检测到系统Chrome路径，请确保Chrome已安装');
        }
        
        // 创建新账号的用户数据目录
        const newAccountId = `account_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const userDataDir = accountManager.createUserDataDir(newAccountId);
        log(`为新账号创建用户数据目录: ${userDataDir}`);
        
        // 为新账号创建独立的浏览器实例，指定用户数据目录
        log('创建新的浏览器实例用于新账号登录...');
        const accountBrowser = await withRetry(async () => {
            return await puppeteer.launch({
                headless: config.headless,
                defaultViewport: null,
                args: [
                    '--start-maximized',
                    `--user-data-dir=${userDataDir}`
                ],
                executablePath: chromePath || undefined
            });
        }, '启动浏览器实例');
        
        // 在新创建的浏览器实例中创建页面
        const page = await accountBrowser.newPage();
        
        // 导航到微信公众号登录页
        await page.goto('https://mp.weixin.qq.com/');
        await wait(2000);
        
        // 等待用户登录
        log('请在新打开的浏览器窗口中扫码登录...');
        const loggedIn = await waitForLogin(page);
        if (!loggedIn) {
            log('登录失败或未检测到登录状态');
            await wait(5000);
            await accountBrowser.close();
            return;
        }
        
        // 登录成功后，获取公众号信息并保存
        log('登录成功，正在获取公众号信息...');
        const accountInfo = await accountManager.getAccountInfoFromPage(page);
        
        // 完善账号信息
        const fullAccountInfo = {
            id: newAccountId,
            name: accountInfo.name,
            wechatId: accountInfo.wechatId,
            avatar: accountInfo.avatar,
            userDataDir: userDataDir,
            lastLogin: new Date().toISOString()
        };
        
        // 保存账号信息
        const saved = accountManager.addAccount(fullAccountInfo);
        if (saved) {
            log(`账号信息保存成功: ${accountInfo.name} (${accountInfo.wechatId})`);
            log(`账号数据目录: ${userDataDir}`);
        } else {
            log('账号信息保存失败');
        }
        
        // 将账号页面添加到活跃账号映射中
        activeAccountPages.set(newAccountId, { page, browser: accountBrowser });
        
        // 在页面中插入状态显示和操作面板
        await withRetry(async () => {
            await page.evaluate((videoDirectory) => {
                const controlPanel = document.createElement('div');
                controlPanel.id = 'auto-controller-panel';
                controlPanel.style.position = 'fixed';
                controlPanel.style.top = '20px';
                controlPanel.style.left = '20px';
                controlPanel.style.zIndex = '9999';
                controlPanel.style.backgroundColor = 'white';
                controlPanel.style.border = '1px solid #e7e7eb';
                controlPanel.style.borderRadius = '8px';
                controlPanel.style.padding = '15px';
                controlPanel.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                controlPanel.style.maxWidth = '350px';
                controlPanel.style.fontSize = '14px';
                controlPanel.style.color = '#333';
                controlPanel.style.fontFamily = '-apple-system, BlinkMacSystemFont, sans-serif';
                
                // 标题
                const title = document.createElement('h4');
                title.textContent = '微信公众号自动控制器';
                title.style.margin = '0 0 15px 0';
                title.style.fontSize = '16px';
                title.style.color = '#1aad19';
                
                // 状态信息
                const statusInfo = document.createElement('div');
                statusInfo.id = 'status-info';
                statusInfo.textContent = '状态：账号添加完成，登录信息已保存';
                statusInfo.style.marginBottom = '15px';
                statusInfo.style.fontSize = '13px';
                statusInfo.style.color = '#666';
                
                // 操作按钮容器
                const actionsContainer = document.createElement('div');
                actionsContainer.style.display = 'flex';
                actionsContainer.style.gap = '10px';
                actionsContainer.style.flexWrap = 'wrap';
                
                // 刷新按钮
                const refreshButton = document.createElement('button');
                refreshButton.textContent = '刷新页面';
                refreshButton.style.padding = '6px 12px';
                refreshButton.style.backgroundColor = '#07c160';
                refreshButton.style.color = 'white';
                refreshButton.style.border = 'none';
                refreshButton.style.borderRadius = '4px';
                refreshButton.style.cursor = 'pointer';
                refreshButton.style.fontSize = '12px';
                refreshButton.style.transition = 'background-color 0.3s';
                
                refreshButton.addEventListener('mouseover', () => {
                    refreshButton.style.backgroundColor = '#06ad56';
                });
                
                refreshButton.addEventListener('mouseout', () => {
                    refreshButton.style.backgroundColor = '#07c160';
                });
                
                refreshButton.addEventListener('click', () => {
                    location.reload();
                });
                
                // 帮助按钮
                const helpButton = document.createElement('button');
                helpButton.textContent = '帮助';
                helpButton.style.padding = '6px 12px';
                helpButton.style.backgroundColor = '#1890ff';
                helpButton.style.color = 'white';
                helpButton.style.border = 'none';
                helpButton.style.borderRadius = '4px';
                helpButton.style.cursor = 'pointer';
                helpButton.style.fontSize = '12px';
                helpButton.style.transition = 'background-color 0.3s';
                
                helpButton.addEventListener('mouseover', () => {
                    helpButton.style.backgroundColor = '#40a9ff';
                });
                
                helpButton.addEventListener('mouseout', () => {
                    helpButton.style.backgroundColor = '#1890ff';
                });
                
                helpButton.addEventListener('click', () => {
                    alert(
                        '使用说明：\n\n' +
                        '1. 账号添加完成后，登录状态已保存\n' +
                        '2. 您可以关闭当前窗口，稍后通过账号管理页面切换到此账号\n' +
                        '3. 下次切换到此账号时，无需重新登录\n' +
                        '\n注意：请确保Chrome浏览器版本与Puppeteer兼容'
                    );
                });
                
                // 添加到容器
                actionsContainer.appendChild(refreshButton);
                actionsContainer.appendChild(helpButton);
                
                // 添加到控制面板
                controlPanel.appendChild(title);
                controlPanel.appendChild(statusInfo);
                
                document.body.appendChild(controlPanel);
            }, config.videoDirectory);
        }, '创建操作面板');
        
        log('账号添加完成，登录状态已保存');
        log('您可以关闭当前窗口，稍后通过账号管理页面切换到此账号');
        
        // 启动监测页面URL变化
        await monitorPageUrl(page, accountBrowser);
        
    } catch (error) {
        log(`程序运行出错: ${error.message}`);
        console.error('错误详情:', error);
        
        // 创建错误日志文件
        const errorLogPath = path.join(__dirname, 'error.log');
        try {
            const errorInfo = `[${new Date().toISOString()}] 错误: ${error.message}\n` +
                            `堆栈跟踪: ${error.stack}\n` +
                            '----------------------------------------\n';
            fs.appendFileSync(errorLogPath, errorInfo, 'utf8');
            log(`详细错误信息已保存至: ${errorLogPath}`);
        } catch (e) {
            console.error('无法保存错误日志:', e.message);
        }
    } finally {
        log('微信公众号自动控制器程序结束');
        console.log('============================================');
        console.log('  程序已结束，感谢使用微信公众号自动控制器');
        console.log('============================================');
    }
};

// 检查登录状态
const checkLoginStatus = async (page) => {
    try {
        // 检查页面是否已登录（通过检查是否包含token）
        const url = await page.url();
        if (url.includes('token=')) {
            return true;
        }
        
        // 等待页面加载完成
        await page.waitForSelector('body', { timeout: 3000 });
        
        // 检查页面中是否有登录相关的元素
        const hasLoginElements = await page.evaluate(() => {
            // 检查是否存在扫码登录的二维码
            const qrcode = document.querySelector('div.login_code_img');
            // 检查是否存在登录成功后的菜单
            const menu = document.querySelector('#main-container');
            
            return menu !== null && qrcode === null;
        });
        
        return hasLoginElements;
    } catch (error) {
        log(`检查登录状态时出错: ${error.message}`);
        return false;
    }
};

// 切换到指定账号
const switchToAccount = async (accountId) => {
    try {
        // 获取系统Chrome路径
        const chromePath = getSystemChromePath();
        if (!chromePath) {
            log('警告：未能自动检测到系统Chrome路径，请确保Chrome已安装');
        }
        
        // 获取账号信息
        const account = accountManager.getAccountById(accountId);
        if (!account) {
            log(`错误：找不到账号ID为 ${accountId} 的账号信息`);
            return;
        }
        
        // 检查用户数据目录是否存在
        if (!fs.existsSync(account.userDataDir)) {
            log(`错误：账号的用户数据目录不存在: ${account.userDataDir}`);
            return;
        }
        
        log(`加载账号: ${account.name} (${account.wechatId})`);
        
        // 为每个账号创建独立的浏览器实例，使用该账号的用户数据目录
        const browser = await withRetry(async () => {
            return await puppeteer.launch({
                headless: config.headless,
                defaultViewport: null,
                args: [
                    '--start-maximized',
                    `--user-data-dir=${account.userDataDir}`
                ],
                executablePath: chromePath || undefined
            });
        }, '启动浏览器');
        
        // 监听浏览器关闭事件
        browser.on('disconnected', () => {
            log(`${account.name} 的浏览器已关闭`);
            activeAccountPages.delete(accountId);
        });
        
        // 创建新标签页
        const page = await browser.newPage();
        
        // 保存当前账号的浏览器和页面引用
        activeAccountPages.set(accountId, { page, browser, userDataDir: account.userDataDir });
        
        // 导航到微信公众号首页
        await page.goto('https://mp.weixin.qq.com/');
        await wait(2000);
        
        // 检查登录状态
        const loggedIn = await checkLoginStatus(page);
        if (!loggedIn) {
            log('账号登录状态已失效，请重新登录');
            
            // 重新等待登录
            const reLoggedIn = await waitForLogin(page);
            if (!reLoggedIn) {
                log('重新登录失败，程序将在10秒后退出');
                await wait(10000);
                if (browser && browser.isConnected()) {
                    await browser.close();
                }
                return;
            }
            
            // 更新账号最后登录时间
            accountManager.updateAccountLastLogin(accountId);
        }
        
        // 更新账号最后登录时间
        accountManager.updateAccountLastLogin(accountId);
        
        // 登录成功后，继续执行
        log(`账号 ${account.name} 登录成功，开始监测页面URL变化...`);
        
        // 在页面中插入状态显示和操作面板，显示当前账号信息
        await withRetry(async () => {
            await page.evaluate((videoDirectory, accountInfo) => {
                const controlPanel = document.createElement('div');
                controlPanel.id = 'auto-controller-panel';
                controlPanel.style.position = 'fixed';
                controlPanel.style.top = '20px';
                controlPanel.style.left = '20px';
                controlPanel.style.zIndex = '9999';
                controlPanel.style.backgroundColor = 'white';
                controlPanel.style.border = '1px solid #e7e7eb';
                controlPanel.style.borderRadius = '8px';
                controlPanel.style.padding = '15px';
                controlPanel.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
                controlPanel.style.maxWidth = '350px';
                controlPanel.style.fontSize = '14px';
                controlPanel.style.color = '#333';
                controlPanel.style.fontFamily = '-apple-system, BlinkMacSystemFont, sans-serif';
                
                // 标题
                const title = document.createElement('h4');
                title.textContent = '微信公众号增强功能已加载';
                title.style.margin = '0 0 15px 0';
                title.style.fontSize = '16px';
                title.style.color = '#1aad19';
                
                // 添加到控制面板
                controlPanel.appendChild(title);
                document.body.appendChild(controlPanel);
            }, account);
        }, '创建操作面板');
        
        // 开始监测页面URL变化
        await monitorPageUrl(page, browser);
        
    } catch (error) {
        log(`切换账号时出错: ${error.message}`);
        console.error('错误详情:', error);
        
        // 创建错误日志文件
        const errorLogPath = path.join(__dirname, 'error.log');
        try {
            const errorInfo = `[${new Date().toISOString()}] 错误: ${error.message}\n` +
                            `堆栈跟踪: ${error.stack}\n` +
                            '----------------------------------------\n';
            fs.appendFileSync(errorLogPath, errorInfo, 'utf8');
            log(`详细错误信息已保存至: ${errorLogPath}`);
        } catch (e) {
            console.error('无法保存错误日志:', e.message);
        }
    }
};



// 主函数，支持多账号功能
async function main() {
    try {
        // 解析命令行参数
        const args = parseCommandLineArgs();
        
        // 检查是否通过URL参数传递了操作（用于网页点击）
        if (process.argv.length > 2 && process.argv[2].startsWith('?')) {
            // 解析URL参数
            const urlParams = new URLSearchParams(process.argv[2].substring(1));
            const action = urlParams.get('action') || args.action;
            const accountId = urlParams.get('accountId') || args.accountId;
            
            await handleAction(action, accountId);
        } else {
            // 检查是否有命令行参数
            if (args.action !== 'manage') {
                // 如果是特定操作，交给handleAction处理
                await handleAction(args.action, args.accountId);
            } else {
                // 否则使用默认的账号管理模式
                await handleAction('manage', null);
            }
        }
    } catch (error) {
        log(`程序执行出错: ${error.message}`);
        console.error(error);
        await wait(5000);
    }
};

// 开始执行
main();
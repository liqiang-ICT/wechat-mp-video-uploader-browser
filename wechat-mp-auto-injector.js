// 微信公众号自动注入工具
// 在Chrome控制台中粘贴并运行

console.log('微信公众号自动注入工具已加载');

/**
 * 打开微信公众号登录页面
 */
function openWechatMpLoginPage() {
    console.log('正在打开微信公众号登录页面...');
    window.open('https://mp.weixin.qq.com/', '_blank');
}

/**
 * 监测当前页面URL，根据URL特征注入相应的脚本
 */
function monitorAndInjectScripts() {
    console.log('开始监测页面URL...');
    
    // 监听页面URL变化
    const observer = new MutationObserver(() => {
        checkAndInjectScripts();
    });
    
    observer.observe(document, {
        childList: true,
        subtree: true
    });
    
    // 初始检查
    checkAndInjectScripts();
    
    console.log('页面监测已启动');
}

/**
 * 检查页面URL并注入相应的脚本
 */
function checkAndInjectScripts() {
    const currentUrl = window.location.href;
    console.log('当前页面URL:', currentUrl);
    
    // 检查是否为视频素材管理页
    if (currentUrl.includes('cgi-bin/appmsg') && currentUrl.includes('action=list_video')) {
        console.log('检测到视频素材管理页，准备注入chrome-debug-uploader.js...');
        injectChromeDebugUploader();
    }
    // 检查是否为用户管理页
    else if (currentUrl.includes('cgi-bin/user_tag') && currentUrl.includes('action=get_all_data')) {
        console.log('检测到用户管理页，准备注入chrome-debug-tag.js...');
        injectChromeDebugTag();
    }
    // 检查是否为登录页
    else if (currentUrl.includes('mp.weixin.qq.com') && currentUrl.includes('cgi-bin/login')) {
        console.log('当前为登录页，请登录后继续');
    }
}

/**
 * 注入chrome-debug-uploader.js
 */
function injectChromeDebugUploader() {
    // 检查是否已经注入过
    if (document.getElementById('chrome-debug-uploader-script')) {
        console.log('chrome-debug-uploader.js已经注入过，跳过注入');
        return;
    }
    
    console.log('开始注入chrome-debug-uploader.js...');
    
    // 在控制台环境中，我们直接使用用户手动复制的方式
    createScriptInjectionButton('chrome-debug-uploader.js', '视频上传工具');
}

/**
 * 注入chrome-debug-tag.js
 */
function injectChromeDebugTag() {
    // 检查是否已经注入过
    if (document.getElementById('chrome-debug-tag-script')) {
        console.log('chrome-debug-tag.js已经注入过，跳过注入');
        return;
    }
    
    console.log('开始注入chrome-debug-tag.js...');
    
    // 在控制台环境中，我们直接使用用户手动复制的方式
    createScriptInjectionButton('chrome-debug-tag.js', '用户标签工具');
}

/**
 * 创建脚本注入按钮
 * @param {string} fileName - 文件名
 * @param {string} toolName - 工具名称
 */
function createScriptInjectionButton(fileName, toolName) {
    // 移除已存在的相同按钮
    const existingButton = document.getElementById(`inject-${fileName}-button`);
    if (existingButton) {
        existingButton.remove();
    }
    
    console.log(`创建${toolName}注入按钮...`);
    
    // 创建一个按钮，让用户手动点击注入
    const button = document.createElement('button');
    button.id = `inject-${fileName}-button`;
    button.textContent = `点击注入${toolName}`;
    button.style.position = 'fixed';
    
    // 根据工具类型设置不同位置
    if (fileName.includes('uploader')) {
        button.style.top = '10px';
        button.style.backgroundColor = '#1aad19';
    } else {
        button.style.top = '60px';
        button.style.backgroundColor = '#07c160';
    }
    
    button.style.right = '10px';
    button.style.zIndex = '9999';
    button.style.padding = '10px 20px';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '4px';
    button.style.cursor = 'pointer';
    button.style.fontSize = '14px';
    button.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
    
    button.addEventListener('click', () => {
        // 提示用户手动复制粘贴脚本内容
        const message = `请按照以下步骤操作:\n1. 打开文件资源管理器\n2. 找到并打开 ${fileName} 文件\n3. 复制文件的全部内容\n4. 返回浏览器，按F12打开开发者工具\n5. 切换到控制台(Console)标签页\n6. 粘贴复制的内容并按Enter键运行`;
        
        alert(message);
        
        // 尝试打开开发者工具控制台
        try {
            // 这个方法在某些浏览器中可能不起作用，但值得尝试
            console.log('请按F12打开开发者工具并切换到控制台(Console)标签页');
        } catch (e) {
            console.error('无法自动打开开发者工具:', e);
        }
    });
    
    document.body.appendChild(button);
    
    // 更新状态
    updateStatus(`已创建${toolName}注入按钮，请点击按钮查看详细操作步骤`);
}

/**
 * 初始化函数
 */
function initWechatMpAutoInjector() {
    console.log('微信公众号自动注入工具初始化中...');
    
    // 创建一个简单的界面，让用户可以控制工具
    createControlInterface();
    
    // 检查当前是否已经在微信公众号页面
    if (window.location.href.includes('mp.weixin.qq.com')) {
        console.log('当前已在微信公众号页面，开始监测页面URL');
        monitorAndInjectScripts();
    }
    
    console.log('微信公众号自动注入工具初始化完成');
}

/**
 * 创建控制界面
 */
function createControlInterface() {
    const controlPanel = document.createElement('div');
    controlPanel.id = 'wechat-mp-control-panel';
    controlPanel.style.position = 'fixed';
    controlPanel.style.top = '20px';
    controlPanel.style.left = '20px';
    controlPanel.style.zIndex = '9999';
    controlPanel.style.backgroundColor = 'white';
    controlPanel.style.border = '1px solid #e7e7eb';
    controlPanel.style.borderRadius = '8px';
    controlPanel.style.padding = '15px';
    controlPanel.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
    
    const title = document.createElement('h3');
    title.textContent = '微信公众号自动注入工具';
    title.style.margin = '0 0 10px 0';
    title.style.fontSize = '16px';
    title.style.color = '#333';
    
    const loginButton = document.createElement('button');
    loginButton.textContent = '打开微信公众号登录页';
    loginButton.style.display = 'block';
    loginButton.style.width = '100%';
    loginButton.style.padding = '8px';
    loginButton.style.marginBottom = '10px';
    loginButton.style.backgroundColor = '#1aad19';
    loginButton.style.color = 'white';
    loginButton.style.border = 'none';
    loginButton.style.borderRadius = '4px';
    loginButton.style.cursor = 'pointer';
    
    loginButton.addEventListener('click', openWechatMpLoginPage);
    
    const checkButton = document.createElement('button');
    checkButton.textContent = '检查当前页面';
    checkButton.style.display = 'block';
    checkButton.style.width = '100%';
    checkButton.style.padding = '8px';
    checkButton.style.marginBottom = '10px';
    checkButton.style.backgroundColor = '#07c160';
    checkButton.style.color = 'white';
    checkButton.style.border = 'none';
    checkButton.style.borderRadius = '4px';
    checkButton.style.cursor = 'pointer';
    
    checkButton.addEventListener('click', checkAndInjectScripts);
    
    const statusDiv = document.createElement('div');
    statusDiv.id = 'wechat-mp-status';
    statusDiv.style.fontSize = '12px';
    statusDiv.style.color = '#666';
    statusDiv.style.marginTop = '10px';
    statusDiv.textContent = '状态：等待操作...';
    
    controlPanel.appendChild(title);
    controlPanel.appendChild(loginButton);
    controlPanel.appendChild(checkButton);
    controlPanel.appendChild(statusDiv);
    
    document.body.appendChild(controlPanel);
}

/**
 * 更新状态信息
 */
function updateStatus(message) {
    const statusDiv = document.getElementById('wechat-mp-status');
    if (statusDiv) {
        statusDiv.textContent = '状态：' + message;
    }
    console.log('[状态更新]', message);
}

// 当页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWechatMpAutoInjector);
} else {
    // 页面已经加载完成，直接初始化
    initWechatMpAutoInjector();
}

// 导出主要函数，方便在控制台手动调用
window.WechatMpAutoInjector = {
    init: initWechatMpAutoInjector,
    openLoginPage: openWechatMpLoginPage,
    checkAndInject: checkAndInjectScripts,
    updateStatus: updateStatus
};
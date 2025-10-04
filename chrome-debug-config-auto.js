// Chrome调试工具专用视频配置自动操作脚本
// 在微信公众号视频配置页面（cgi-bin/appmsg?t=media/appmsg_edit_v2&action=edit）自动执行以下操作：
// 1. 点击留言配置按钮并确认
// 2. 点击声明按钮，选择"内容来自AI"，点击确认
// 3. 点击保存按钮完成配置

console.log('微信公众号视频配置自动操作脚本已加载');

/**
 * 显示调试信息
 * @param {string} message - 调试信息内容
 */
function showDebugInfo(message) {
    const debugElement = document.getElementById('chrome-debug-config-info');
    if (debugElement) {
        debugElement.textContent = message;
        debugElement.style.display = 'block';
        console.log('[配置自动操作]', message);
    } else {
        console.log('[配置自动操作]', message);
    }
}

/**
 * 追加调试信息
 * @param {string} message - 要追加的信息
 */
function appendDebugInfo(message) {
    const debugElement = document.getElementById('chrome-debug-config-info');
    if (debugElement) {
        debugElement.textContent += '\n' + message;
        console.log('[配置自动操作]', message);
    } else {
        console.log('[配置自动操作]', message);
    }
}

/**
 * 等待指定时间
 * @param {number} ms - 毫秒数
 * @returns {Promise<void>}
 */
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 尝试多种选择器查找元素
 * @param {Array<string>} selectors - 选择器数组
 * @returns {Element|null}
 */
function findElementWithMultipleSelectors(selectors) {
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            console.log(`使用选择器成功找到元素: ${selector}`);
            return element;
        }
    }
    console.warn(`尝试了 ${selectors.length} 种选择器都未能找到元素`);
    return null;
}

/**
 * 尝试点击元素
 * @param {Element} element - 要点击的元素
 * @param {string} elementName - 元素名称（用于日志）
 * @returns {boolean} 是否点击成功
 */
function tryClickElement(element, elementName = '元素') {
    if (!element) {
        console.error(`${elementName}不存在，无法点击`);
        return false;
    }

    try {
        element.click();
        console.log(`成功点击 ${elementName}`);
        return true;
    } catch (error) {
        console.error(`点击 ${elementName} 时出错:`, error);
        return false;
    }
}

/**
 * 尝试多次查找元素，直到找到或超时
 * @param {Array<string>} selectors - 选择器数组
 * @param {number} maxAttempts - 最大尝试次数
 * @param {number} interval - 尝试间隔（毫秒）
 * @returns {Promise<Element|null>}
 */
async function waitForElement(selectors, maxAttempts = 10, interval = 300) {
    let attempts = 0;
    while (attempts < maxAttempts) {
        const element = findElementWithMultipleSelectors(selectors);
        if (element) {
            return element;
        }
        attempts++;
        appendDebugInfo(`等待元素出现，第${attempts}/${maxAttempts}次尝试`);
        await wait(interval);
    }
    console.error(`等待元素超时，未找到: ${selectors.join(', ')}`);
    return null;
}

/**
 * 自动配置视频发布设置
 */
async function autoConfigureVideoPublish() {
    try {
        appendDebugInfo('开始自动配置视频发布设置...');
        
        // 步骤1: 点击留言配置按钮并确认
        await handleCommentConfig();
        
        // 步骤2: 点击声明按钮，选择"内容来自AI"，点击确认
        await handleContentDeclaration();
        
        // 步骤3: 点击保存按钮完成配置
        await handleSave();
        
        appendDebugInfo('视频发布配置已自动完成！');
        // 关闭页面
        window.close();
        
    } catch (error) {
        console.error('自动配置过程中出错:', error);
        appendDebugInfo(`配置过程出错: ${error.message}`);
    }
}

/**
 * 处理留言配置
 */
async function handleCommentConfig() {
    appendDebugInfo('正在处理留言配置...');
    
    // 查找留言配置按钮
    const commentConfigSelectors = [
        '.setting-group__switch-tips_default'
    ];
    
    const commentButton = await waitForElement(commentConfigSelectors);
    if (commentButton) {
        tryClickElement(commentButton, '留言配置按钮');
        
        // 查找确认按钮
        const confirmButtonSelectors = [
            '.interaction-dialog__footer .weui-desktop-btn_primary'
        ];
        
        const confirmButton = await waitForElement(confirmButtonSelectors);
        if (confirmButton) {
            tryClickElement(confirmButton, '留言配置确认按钮');
            appendDebugInfo('留言配置已成功开启');
        }
    }
}

/**
 * 处理内容声明
 */
async function handleContentDeclaration() {
    appendDebugInfo('正在处理内容声明...');
    
    // 查找"内容来自AI"选项
    const aiContentSelectors = [
        'input[data-label="内容由AI生成"]'
    ];
    
    const aiContentOption = await waitForElement(aiContentSelectors);
    if (aiContentOption) {
        tryClickElement(aiContentOption, '内容来自AI选项');
        appendDebugInfo('内容声明已设置为"内容来自AI"');
    }
}

/**
 * 处理保存操作
 */
async function handleSave() {
    appendDebugInfo('正在保存配置...');
    
    // 查找保存按钮
    const saveButtonSelectors = [
        '#js_submit button'
    ];
    
    const saveButton = await waitForElement(saveButtonSelectors);
    if (saveButton) {
        tryClickElement(saveButton, '保存按钮');
        appendDebugInfo('已点击保存按钮');
        
        // 等待保存操作完成（按钮状态为可点击状态）
        appendDebugInfo('等待保存操作完成...');
        await wait(1000);
        while (saveButton.disabled) {
            await wait(1000);
            appendDebugInfo('保存ing...');
        }
        appendDebugInfo('保存操作已完成');
    }
}

/**
 * 检查当前页面是否为视频配置页面
 */
function isVideoConfigPage() {
    const url = window.location.href;
    return url.includes('mp.weixin.qq.com') && 
           url.includes('cgi-bin/appmsg') && 
           url.includes('t=media/appmsg_edit_v2') && 
           url.includes('action=edit');
}

/**
 * 初始化调试信息区域
 */
function initDebugInfoArea() {
    // 检查是否已存在调试信息区域
    if (document.getElementById('chrome-debug-config-info')) {
        return;
    }
    
    const debugInfo = document.createElement('div');
    debugInfo.id = 'chrome-debug-config-info';
    debugInfo.style.position = 'fixed';
    debugInfo.style.top = '10px';
    debugInfo.style.right = '10px';
    debugInfo.style.zIndex = '10000';
    debugInfo.style.backgroundColor = '#f5f5f5';
    debugInfo.style.border = '2px solid #4CAF50';
    debugInfo.style.borderRadius = '4px';
    debugInfo.style.padding = '10px';
    debugInfo.style.minWidth = '300px';
    debugInfo.style.maxHeight = '400px';
    debugInfo.style.overflow = 'auto';
    debugInfo.style.fontSize = '12px';
    debugInfo.style.whiteSpace = 'pre-wrap';
    debugInfo.style.fontFamily = 'monospace';
    debugInfo.style.color = '#333';
    debugInfo.textContent = '视频配置自动操作脚本已加载，准备开始自动配置...';
    
    document.body.appendChild(debugInfo);
}

/**
 * 主函数：初始化并执行自动配置
 */
async function initAutoConfig() {
    // 检查是否在视频配置页面
    if (!isVideoConfigPage()) {
        console.log('当前页面不是视频配置页面，脚本将不会执行');
        return;
    }
    
    // 初始化调试信息区域
    initDebugInfoArea();
    
    // 设置页面加载完成标记
    window.videoConfigPageLoaded = true;
    
    // 等待页面完全加载
    // await wait(3000);
    
    // 开始自动配置
    await autoConfigureVideoPublish();
}

// 当页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoConfig);
} else {
    // 页面已经加载完成，直接初始化
    initAutoConfig();
}

// 导出函数供外部调用
window.WechatVideoAutoConfig = {
    init: initAutoConfig,
    autoConfigureVideoPublish: autoConfigureVideoPublish,
    handleCommentConfig: handleCommentConfig,
    handleContentDeclaration: handleContentDeclaration,
    handleSave: handleSave
};
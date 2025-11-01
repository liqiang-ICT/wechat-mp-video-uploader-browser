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

        // 步骤1：复制标题框内容到描述框
        const titleElement = await waitForElement(['#title']);
        let titleText = '';
        if (titleElement) {
            titleText = titleElement.value.trim();
            if (titleText) {
                appendDebugInfo(`标题框内容: ${titleText}`);

            } else {
                appendDebugInfo('标题框为空，无需复制');
            }
        } else {
            appendDebugInfo('未找到标题框，无法复制标题内容');
        }

        // 步骤2：点击”新文章“替换按钮
        await clickArticleReplaceButton('0');

        const newTitleElement = await waitForElement(['#title']);
        if (newTitleElement) {
            newTitleElement.value = titleText;
            appendDebugInfo(`已将标题内容复制到新文章: ${titleText}`);
        } else {
            appendDebugInfo('未找到描述框，无法复制标题内容');
        }

        // 步骤5：点击保存按钮完成配置
        await handleSave();

        // 步骤6：点击”视频“替换按钮
        await clickArticleReplaceButton('5');

        // 步骤7：根据标题选择正确的替换视频
        await selectVideoByTitle(titleText);

        // 步骤8: 点击留言配置按钮并确认
        await handleCommentConfig();

        // 步骤9: 点击声明按钮，选择"内容来自AI"，点击确认
        await handleContentDeclaration();

        // 步骤10: 点击保存按钮完成配置
        await handleSave();

        appendDebugInfo('视频发布配置已自动完成！');

        // 标记配置已完成，便于控制器识别
        // 调试：暂时不要关闭页面，方便查看调试信息
        window._configAutoCompleted = true;

    } catch (error) {
        console.error('自动配置过程中出错:', error);
        appendDebugInfo(`配置过程出错: ${error.message}`);
    }
}

/**
 * 根据标题选择正确的替换视频
 * @param {string} titleText - 视频标题文本
 */
async function selectVideoByTitle(titleText) {
    appendDebugInfo(`正在根据标题选择视频: ${titleText}`);

    // 查找视频列表
    const videoListSelectors = [
        '.more-video__list.more-video__list_double'
    ];

    const videoList = await waitForElement(videoListSelectors);
    if (videoList) {
        // 遍历视频列表，查找标题匹配的视频
        let videos = videoList.querySelectorAll('.more-video__item');
        while (videos.length === 0) {
            appendDebugInfo('视频列表为空，等待加载...');
            await wait(1000);
            videos = videoList.querySelectorAll('.more-video__item');
        }
        appendDebugInfo(`视频列表中找到 ${videos.length} 个视频`);
        for (const video of videos) {
            const videoTitle = video.querySelector('.more-video__item-title').textContent.trim();
            if (videoTitle.includes(titleText)) {
                tryClickElement(video.querySelector('.more-video__item-content'), `标题匹配视频: ${videoTitle}`);
                appendDebugInfo(`已选择标题匹配视频: ${videoTitle}`);

                // 步骤9：点击确认按钮
                const confirmButtonSelectors = [
                    'div.video-select-dialog > div.weui-desktop-dialog__wrp > div > div.weui-desktop-dialog__ft > div > div:nth-child(3) > button'
                ];

                const confirmButton = await waitForElement(confirmButtonSelectors);
                if (confirmButton) {
                    tryClickElement(confirmButton, '确认选择视频');
                    appendDebugInfo('已点击确认选择视频');
                } else {
                    appendDebugInfo('未找到确认按钮，无法点击');
                }
                break;
            }
        }
        appendDebugInfo('未找到匹配标题的视频');
    } else {
        appendDebugInfo('未找到视频列表，无法根据标题选择视频');
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
 * 点击"广告"配置按钮
 */
async function clickAdConfigButton() {
    appendDebugInfo('正在点击"广告"配置按钮...');

    // 查找"广告"配置按钮
    const adConfigSelectors = [
        '.js_insert_ad_allow_click'
    ];

    const adConfigButton = await waitForElement(adConfigSelectors);
    if (adConfigButton) {
        tryClickElement(adConfigButton, '"广告"配置按钮');
        appendDebugInfo('已点击"广告"配置按钮');
    } else {
        appendDebugInfo('未找到"广告"配置按钮，无法点击');
    }
}

/**
 * 全选所有广告配置
 */
async function selectAllAdConfigs() {
    appendDebugInfo('正在全选所有广告配置...');

    // 1. 配置"文中广告"
    // 1.1 选择”插入方式“为”智能插入“
    const adInArticleSelectors = [
        'div.adui-radio-group label:nth-child(1)'
    ];
    const adInArticle = await waitForElement(adInArticleSelectors);
    if (adInArticle) {
        tryClickElement(adInArticle, '"智能插入"配置选项');
        appendDebugInfo('已选中"智能插入"配置选项');
    } else {
        appendDebugInfo('未找到"智能插入"配置选项，无法点击');
    }
    // 1.2 选择”商品类目“为”全部类目“
    const allCategorySelectors = [
        '.adui-spinner-nestedWrapper .adui-spinner-container .adui-checkbox-base'
    ];
    const allCategory = await waitForElement(allCategorySelectors);
    if (allCategory) {
        if (!allCategory.classList.contains('adui-checkbox-base_checked')) {
            tryClickElement(allCategory, '"全部类目"配置选项');
            appendDebugInfo('已选中"全部类目"配置选项');
        } else {
            appendDebugInfo('"全部类目"配置选项已选中');
        }
        appendDebugInfo('已配置"全部类目"配置选项');
    } else {
        appendDebugInfo('未找到"全部类目"配置选项，无法点击');
    }
    // 1.3 设置”保存为默认配置“为”是“
    const saveAsDefaultSelectors = [
        '.adui-form-base .adui-form-item:nth-child(3) .adui-form-control .adui-checkbox-base'
    ];
    const saveAsDefault = await waitForElement(saveAsDefaultSelectors);
    if (saveAsDefault) {
        if (!saveAsDefault.classList.contains('adui-checkbox-base_checked')) {
            tryClickElement(saveAsDefault, '"保存为默认配置"配置选项');
            appendDebugInfo('已选中"保存为默认配置"配置选项');
        } else {
            appendDebugInfo('"保存为默认配置"配置选项已选中');
        }
        appendDebugInfo('已配置"保存为默认配置"配置选项');
    } else {
        appendDebugInfo('未找到"保存为默认配置"配置选项，无法点击');
    }

    // 2. 配置"留言区广告"
    // 2.1 点击”留言区广告“配置选项
    const commentAdSelectors = [
        '.ad-pub-tab.adui-tabs-base .adui-tabs-tab:nth-child(3)'
    ];
    const commentAd = await waitForElement(commentAdSelectors);
    if (commentAd) {
        tryClickElement(commentAd, '"留言区广告"配置选项');
        appendDebugInfo('已点击"留言区广告"配置选项');
    } else {
        appendDebugInfo('未找到"留言区广告"配置选项，无法点击');
    }
    // 2.2 选择”展示留言区广告“为”是“
    const showCommentAdSelectors = [
        'div.ad-pub-middle > div.adui-form-base > div > div.adui-form-control > div.adui-radio-group > label.adui-radio-base.adui-radio-small'
    ];
    const showCommentAd = await waitForElement(showCommentAdSelectors);
    if (showCommentAd) {
        tryClickElement(showCommentAd, '"展示留言区广告"配置选项');
        appendDebugInfo('已选中"展示留言区广告"配置选项');
    } else {
        appendDebugInfo('未找到"展示留言区广告"配置选项，无法点击');
    }
    // 3. 配置"关键词广告"
    // 3.1 点击”关键词广告“配置选项
    const keywordAdSelectors = [
        '.ad-pub-tab.adui-tabs-base .adui-tabs-tab:nth-child(4)'
    ];
    const keywordAd = await waitForElement(keywordAdSelectors);
    if (keywordAd) {
        tryClickElement(keywordAd, '"关键词广告"配置选项');
        appendDebugInfo('已点击"关键词广告"配置选项');
    } else {
        appendDebugInfo('未找到"关键词广告"配置选项，无法点击');
    }
    // 3.2 选择”展示关键词广告“为”是“
    const showKeywordAdSelectors = [
        'div.ad-pub-middle > div.adui-form-base > div > div.adui-form-control > div.adui-radio-group > label.adui-radio-base.adui-radio-small'
    ];
    const showKeywordAd = await waitForElement(showKeywordAdSelectors);
    if (showKeywordAd) {
        tryClickElement(showKeywordAd, '"展示关键词广告"配置选项');
        appendDebugInfo('已选中"展示关键词广告"配置选项');
    } else {
        appendDebugInfo('未找到"展示关键词广告"配置选项，无法点击');
    }
    // 4 点击"保存"按钮
    const saveButtonSelectors = [
        '.adui-button-primary'
    ];
    const saveButton = await waitForElement(saveButtonSelectors);
    if (saveButton) {
        tryClickElement(saveButton, '"保存"按钮');
        appendDebugInfo('已点击广告配置"保存"按钮');
    } else {
        appendDebugInfo('未找到广告配置"保存"按钮，无法点击');
    }
}

/**
 * 点击替换按钮，并根据配置替换不同的类型
 * @param {string} type - 要替换的类型，可选值为"0"（新文章）或"5"（视频）
 */
async function clickArticleReplaceButton(type = '0') {
    appendDebugInfo(`正在点击"${type}"替换按钮...`);

    // 查找”替换“按钮
    const replaceButtonSelectors = [
        '.weui-desktop-icon-btn__exchange'
    ];
    // 查找"新文章"替换按钮
    const articleReplaceSelectors = [
        `li[data-type="${type}"]`
    ];
    // 查找”确认“按钮
    const confirmButtonSelectors = [
        '.js_replace_pop.pos_left_top .btn.btn_primary.jsPopoverBt'
    ];

    const replaceButton = await waitForElement(replaceButtonSelectors);
    if (replaceButton) {
        tryClickElement(replaceButton, '"替换"按钮');
        appendDebugInfo('已点击"替换"按钮');
    } else {
        appendDebugInfo('未找到"替换"按钮，无法点击');
    }

    const articleReplaceButton = await waitForElement(articleReplaceSelectors);
    if (articleReplaceButton) {
        tryClickElement(articleReplaceButton, `"${type}"替换按钮`);
        appendDebugInfo(`已点击"${type}"替换按钮`);

        // 查找确认按钮
        const confirmButton = await waitForElement(confirmButtonSelectors);
        if (confirmButton) {
            tryClickElement(confirmButton, '"确认"按钮');
            appendDebugInfo('已点击"确认"按钮');
        } else {
            appendDebugInfo('未找到"确认"按钮，无法点击');
        }
    } else {
        appendDebugInfo(`未找到"${type}"替换按钮，无法点击`);
    }
}


/**
 * 处理内容声明
 */
async function handleContentDeclaration() {
    appendDebugInfo('正在处理内容声明...');

    // 先点开内容声明面板
    const contentDeclarationSelectors = [
        '.allow_click_opr.js_claim_source_desc'
    ];
    const contentDeclaration = await waitForElement(contentDeclarationSelectors);
    if (contentDeclaration) {
        tryClickElement(contentDeclaration, '内容声明面板');
        appendDebugInfo('已点击内容声明面板');
    } else {
        appendDebugInfo('未找到内容声明面板，无法点击');
        const confirm = window.confirm('未找到内容声明面板，是否继续？');
        if (!confirm) {
            appendDebugInfo('用户选择不继续，跳过内容声明处理');
            return;
        }
    }

    // 查找"内容来自AI"选项
    const aiContentSelectors = [
        'input[type="radio"][class="weui-desktop-form__radio"][value="1"]'
    ];

    const aiContentOption = await waitForElement(aiContentSelectors);
    if (aiContentOption) {
        tryClickElement(aiContentOption, '内容来自AI选项');
        appendDebugInfo('内容声明已设置为"内容来自AI"');
    } else {
        appendDebugInfo('未找到"内容来自AI"选项，无法点击');
        const confirm = window.confirm('未找到"内容来自AI"选项，是否继续？');
        if (!confirm) {
            appendDebugInfo('用户选择不继续，跳过内容声明处理');
            return;
        }
    }

    // 查找"确认"按钮
    const confirmButtonSelectors = [
        'div.claim-source-dialog .weui-desktop-btn_primary'
    ];
    const confirmButton = await waitForElement(confirmButtonSelectors);
    if (confirmButton) {
        tryClickElement(confirmButton, '内容声明确认按钮');
        appendDebugInfo('已点击内容声明确认按钮');
    } else {
        appendDebugInfo('未找到内容声明确认按钮，无法点击');
        const confirm = window.confirm('未找到内容声明确认按钮，是否继续？');
        if (!confirm) {
            appendDebugInfo('用户选择不继续，跳过内容声明处理');
            return;
        }
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
    window.chromeDebugConfigAutoInjected = true;

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
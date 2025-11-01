// Chrome调试工具专用视频上传脚本 - 视频列表页版本
// 在Chrome控制台中粘贴并运行

console.log('微信公众号视频上传调试工具(视频列表页版本)已加载');

/**
 * 显示调试信息
 * @param {string} message - 调试信息内容
 */
function showDebugInfo(message) {
    const debugElement = document.getElementById('chrome-debug-info');
    if (debugElement) {
        debugElement.textContent = message;
        debugElement.style.display = 'block';
        console.log('[调试信息]', message);
    } else {
        console.log('[调试信息]', message);
    }
}

/**
 * 追加调试信息
 * @param {string} message - 要追加的信息
 */
function appendDebugInfo(message) {
    const debugElement = document.getElementById('chrome-debug-info');
    if (debugElement) {
        debugElement.textContent += '\n' + message;
        console.log('[调试信息]', message);
    } else {
        console.log('[调试信息]', message);
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
 * 检查元素是否存在
 * @param {string} selector - CSS选择器
 * @returns {Element|null}
 */
function findElement(selector, iframeDoc = document) {
    const element = iframeDoc.querySelector(selector);
    console.log(`查找元素: ${selector}, 结果: ${element ? '找到' : '未找到'}`);
    return element;
}

/**
 * 尝试多种选择器查找元素
 * @param {Array<string>} selectors - 选择器数组
 * @returns {Element|null}
 */
function findElementWithMultipleSelectors(selectors, iframeDoc = document) {
    for (const selector of selectors) {
        const element = findElement(selector, iframeDoc);
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
 * 尝试填写输入框
 * @param {Element} element - 输入框元素
 * @param {string} value - 要填写的值
 * @param {string} fieldName - 字段名称（用于日志）
 * @returns {boolean} 是否填写成功
 */
function tryFillInput(element, value, fieldName = '输入框') {
    if (!element) {
        console.error(`${fieldName}不存在，无法填写`);
        return false;
    }

    try {
        element.value = value;
        // 触发输入事件
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`成功填写 ${fieldName}: ${value}`);
        return true;
    } catch (error) {
        console.error(`填写 ${fieldName} 时出错:`, error);
        return false;
    }
}

/**
 * 从URL中提取参数值
 * @param {string} url - 包含参数的URL
 * @param {string} paramName - 参数名称
 * @returns {string|null} 参数值或null
 */
function getParamFromUrl(url, paramName) {
    if (!url || !paramName) return null;

    // 解析URL中的查询参数部分
    const queryString = url.split('?')[1];
    if (!queryString) return null;

    // 分割参数并查找目标参数
    const params = queryString.split('&');
    for (const param of params) {
        const [name, value] = param.split('=');
        if (name === paramName) {
            return value;
        }
    }
    return null;
}

/**
 * 规范化文件名，移除末尾的"(x)"格式
 * @param {string} fileName - 原始文件名
 * @returns {string} 规范化后的文件名
 */
function normalizeFileName(fileName) {
    // 检查文件名是否以"(x)"格式结尾，x为数字
    const match = fileName.match(/^(.*)\((\d+)\)(\.[^.]+)?$/);
    if (match) {
        // 提取文件名主体部分和扩展名
        const baseName = match[1].trim();
        const extension = match[3] || '';
        const normalizedName = baseName + extension;
        console.log(`规范化文件名: ${fileName} -> ${normalizedName}`);
        return normalizedName;
    }
    return fileName;
}

/**
 * 创建规范化的File对象
 * @param {File} file - 原始文件对象
 * @returns {File} 规范化后的文件对象
 */
function createNormalizedFile(file) {
    const normalizedName = normalizeFileName(file.name);
    if (normalizedName !== file.name) {
        // 创建新的File对象，保留原始内容但使用规范化的文件名
        return new File([file], normalizedName, {
            type: file.type,
            lastModified: file.lastModified
        });
    }
    return file;
}

/**
 * 清空上传的视频列表
 * @returns {Promise<void>}
 */
async function clearUploadedVideos() {
    try {
        // 获取删除按钮，用于更新进度显示
        const deleteDirButton = document.querySelector('#deleteDirButton');

        // 保存原始按钮文本，用于删除完成后恢复
        const originalButtonText = deleteDirButton ? deleteDirButton.textContent : '删除本页视频';

        // 获取当前页面的URL作为Referer
        const currentUrl = window.location.href;
        console.log(`使用当前页面URL作为Referer: ${currentUrl}`);

        // 从当前URL中提取token
        const token = getParamFromUrl(currentUrl, 'token');
        if (!token) {
            console.error("无法从当前页面URL中提取token，请确保在包含token参数的页面上运行此代码");
            // 恢复按钮文本
            if (deleteDirButton) deleteDirButton.textContent = originalButtonText;
            return;
        }
        console.log(`从当前页面提取到token: ${token}`);

        // 检查wx.cgiData.item是否存在
        if (!wx || !wx.cgiData || !wx.cgiData.item || !Array.isArray(wx.cgiData.item)) {
            console.error("未找到有效的wx.cgiData.item数据");
            // 恢复按钮文本
            if (deleteDirButton) deleteDirButton.textContent = originalButtonText;
            return;
        }

        // 提取所有app_id（AppMsgId）
        const articles = wx.cgiData.item
            .filter(item => item && item.app_id)
            .map(item => ({
                appId: item.app_id,
                title: item.title || "未知标题" // 尝试获取标题以便用户识别
            }));

        if (articles.length === 0) {
            console.log("没有找到可处理的文章数据");
            // 恢复按钮文本
            if (deleteDirButton) deleteDirButton.textContent = originalButtonText;
            return;
        }

        // 更新按钮文本，显示总数
        const totalCount = articles.length;
        if (deleteDirButton) deleteDirButton.textContent = `删除本页视频 (0/${totalCount})`;

        console.log(`共发现 ${totalCount} 篇文章待处理：`);
        articles.forEach((article, index) => {
            console.log(`${index + 1}. ID: ${article.appId}，标题: ${article.title}`);
        });

        // 根据文章数量选择处理方式
        let action;
        if (articles.length === 1) {
            // 只有一篇文章，直接询问是否删除
            action = confirm(`是否删除这篇文章？\nID: ${articles[0].appId}\n标题: ${articles[0].title}`) ? "1" : "0";
        } else {
            // 多篇文章，让用户选择处理方式
            const message = `共发现 ${articles.length} 篇文章，选择处理方式：\n0 - 取消操作\n1 - 逐个确认删除\n2 - 全部删除`;
            action = prompt(message, "0");
        }

        // 处理用户选择
        let successCount = 0;
        switch (action) {
            case "0":
                console.log("已取消所有操作");
                if (deleteDirButton) deleteDirButton.textContent = originalButtonText;
                return;
            case "1":
                console.log("开始逐个确认删除...");
                for (const article of articles) {
                    const confirmDelete = confirm(`是否删除这篇文章？\nID: ${article.appId}\n标题: ${article.title}`);
                    if (confirmDelete) {
                        try {
                            await deleteSingleArticle(article.appId, token, currentUrl);
                            successCount++;
                            // 更新进度
                            if (deleteDirButton) deleteDirButton.textContent = `删除本页视频 (${successCount}/${totalCount})`;
                        } catch (error) {
                            console.error(`删除失败: ${error.message}`);
                        }
                        // 等待一段时间再处理下一个，避免请求过于频繁
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    } else {
                        console.log(`已跳过 ID: ${article.appId} 的文章`);
                    }
                }
                console.log("逐个处理完成");
                break;
            case "2":
                const finalConfirm = confirm(`确定要删除全部 ${articles.length} 篇文章吗？此操作不可恢复！`);
                if (finalConfirm) {
                    console.log("开始批量删除所有文章...");
                    for (const article of articles) {
                        console.log(`正在删除 ID: ${article.appId}`);
                        try {
                            await deleteSingleArticle(article.appId, token, currentUrl);
                            successCount++;
                            // 更新进度
                            if (deleteDirButton) deleteDirButton.textContent = `删除本页视频 (${successCount}/${totalCount})`;
                        } catch (error) {
                            console.error(`删除失败: ${error.message}`);
                        }
                    }
                    console.log(`全部 ${articles.length} 篇文章删除操作已执行完成`);
                } else {
                    console.log("已取消全部删除操作");
                    if (deleteDirButton) deleteDirButton.textContent = originalButtonText;
                    return;
                }
                break;
            default:
                console.log("无效输入，已取消操作");
                if (deleteDirButton) deleteDirButton.textContent = originalButtonText;
                return;
        }

        // 完成后显示最终结果
        if (deleteDirButton) {
            deleteDirButton.textContent = `删除完成 (${successCount}/${totalCount})`;
            // 3秒后恢复原始文本
            setTimeout(() => {
                deleteDirButton.textContent = originalButtonText;
            }, 3000);
        }

        // 刷新页面以显示最新状态
        setTimeout(() => {
            location.reload();
        }, 1000);

    } catch (error) {
        console.error("批量处理过程中发生错误：");
        console.error(error);
        // 发生错误时尝试恢复按钮文本
        const deleteDirButton = document.querySelector('#deleteDirButton');
        if (deleteDirButton) deleteDirButton.textContent = '删除本页视频';
    }
}

// 收集非原创文章的函数
async function collectNonOriginalArticles() {
    const articles = await fetchVideoHistoryRecords(500);
    console.log('共发现文章数：', articles.length);
    console.log('文章列表：', articles);
    if (articles.length === 0) {
        console.log('未发现文章');
        return [];
    }
    const nonOriginalArticles = [];
    for (const article of articles) {
        const isNonOriginal = article.is_non_original === 1;
        if (isNonOriginal) {
            nonOriginalArticles.push({
                app_id: article.app_id,
                title: article.title
            });
        }
    };
    return nonOriginalArticles;
}

// 删除非原创视频的函数
async function deleteNonOriginalVideos() {
    // 按钮文字变为“收集非原创文章中”
    const deleteNonOriginalButton = document.querySelector('#deleteNonOriginalButton');
    if (deleteNonOriginalButton) {
        deleteNonOriginalButton.disabled = true;
        deleteNonOriginalButton.textContent = '收集非原创文章中...';
    }
    // 先收集所有非原创的文章清单，然后参考clearUploadedVideos的逻辑进行逐条删除
    const nonOriginalArticles = await collectNonOriginalArticles();
    if (nonOriginalArticles.length === 0) {
        console.log('未发现非原创文章');
        if (deleteNonOriginalButton) {
            deleteNonOriginalButton.textContent = '删除非原创视频';
            deleteNonOriginalButton.disabled = false;
        }
        return;
    }

    const confirmDelete = confirm(`确定要删除 ${nonOriginalArticles.length} 篇非原创文章吗？此操作不可恢复！`);
    if (!confirmDelete) {
        console.log('已取消删除操作');
        if (deleteNonOriginalButton) {
            deleteNonOriginalButton.textContent = '删除非原创视频';
            deleteNonOriginalButton.disabled = false;
        }
        return;
    }

    let successCount = 0;
    const currentUrl = window.location.href;
    const token = getParamFromUrl(currentUrl, 'token');
    for (const article of nonOriginalArticles) {
        try {
            await deleteSingleArticle(article.app_id, token, currentUrl);
            successCount++;
            // 更新进度
            if (deleteNonOriginalButton) deleteNonOriginalButton.textContent = `删除非原创视频 (${successCount}/${nonOriginalArticles.length})`;
        } catch (error) {
            console.error(`删除失败: ${error.message}`);
        }
    }

    // 刷新页面以显示最新状态
    setTimeout(() => {
        location.reload();
    }, 1000);
}

// 删除单篇文章的函数，接收appMsgId、token和referer参数
async function deleteSingleArticle(appMsgId, token, referer) {
    try {
        // 使用从当前URL提取的token构建请求体
        const requestBody = `AppMsgId=${appMsgId}&token=${token}&lang=zh_CN&f=json&ajax=1`;

        // 发送请求，使用当前页面URL作为Referer
        const response = await fetch("https://mp.weixin.qq.com/cgi-bin/operate_appmsg?sub=del&t=ajax-response", {
            "body": requestBody,
            "method": "POST"
        });

        // 解析响应
        const result = await response.json();

        // 在控制台显示结果
        console.log(`处理 ID: ${appMsgId} 的结果：`);
        console.log(result);

        return result;
    } catch (error) {
        // 捕获并显示错误
        console.error(`处理 ID: ${appMsgId} 时发生错误：`);
        console.error(error);
        throw error;
    }
}

/**
 * 上传单个视频（通过iframe浮窗）
 * @param {File} videoFile - 视频文件对象
 * @param {File} coverFile - 封面文件对象（可选）
 * @returns {Promise<boolean>} 上传是否成功
 */
async function uploadSingleVideo(videoFile, coverFile = null) {
    try {
        // 规范化视频文件名
        const normalizedVideoFile = createNormalizedFile(videoFile);
        // 规范化封面文件名（如果有）
        const normalizedCoverFile = coverFile ? createNormalizedFile(coverFile) : null;

        appendDebugInfo(`开始上传视频: ${normalizedVideoFile.name}`);
        appendDebugInfo(`文件大小: ${(normalizedVideoFile.size / (1024 * 1024)).toFixed(2)} MB`);

        // 创建上传浮窗和iframe
        const iframe = createUploadIframe(normalizedVideoFile);

        // 等待iframe加载完成
        appendDebugInfo('等待iframe加载完成...');
        await new Promise(resolve => {
            iframe.onload = resolve;
            // 设置超时，防止iframe加载失败
            setTimeout(resolve, 10000);
        });

        // 获取iframe的document对象
        let iframeDoc = null;
        try {
            iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (!iframeDoc) {
                appendDebugInfo('无法访问iframe的document对象，可能存在跨域问题');
                // 创建一个脚本注入到iframe中
                injectUploadScriptToIframe(iframe, normalizedVideoFile, normalizedCoverFile);
                return true;
            }
        } catch (error) {
            appendDebugInfo(`访问iframe时出错: ${error.message}，尝试使用脚本注入方式`);
            // 创建一个脚本注入到iframe中
            injectUploadScriptToIframe(iframe, normalizedVideoFile, normalizedCoverFile);
            return true;
        }

        // 如果能直接访问iframe内容，进行上传操作
        if (iframeDoc) {
            // 查找文件输入框
            const fileInputSelectors = [
                'input[type="file"][accept*="video"]'
            ];

            let fileInput = null;
            for (const selector of fileInputSelectors) {
                fileInput = iframeDoc.querySelector(selector);
                if (fileInput) {
                    appendDebugInfo(`在iframe中找到文件输入框: ${selector}`);
                    break;
                }
            }

            if (fileInput) {
                appendDebugInfo('准备设置文件到iframe中的输入框...');

                // 创建一个新的DataTransfer对象
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(videoFile);

                // 设置文件
                try {
                    fileInput.files = dataTransfer.files;
                    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                    appendDebugInfo('文件已设置到iframe中的输入框，等待上传...');

                    // 勾选上传协议
                    const protocolCheckbox = findElement('label.weui-desktop-form__check-label.weui-desktop-form__tool__tips.video-setting__footer-link', iframeDoc);
                    if (protocolCheckbox) {
                        tryClickElement(protocolCheckbox, '上传协议');
                    }

                    // 打开原创开关
                    const originalCheckbox = findElement('input[type="checkbox"][class="weui-desktop-switch__input"]', iframeDoc);
                    if (originalCheckbox) {
                        tryClickElement(originalCheckbox, '原创开关');
                        // 在打开的弹框中点击确认
                        const confirmButton = findElement('div.weui-desktop-dialog_original-video > div.weui-desktop-dialog__wrp > div.weui-desktop-dialog > div.weui-desktop-dialog__ft > div.weui-desktop-btn_wrp > button.weui-desktop-btn_primary', iframeDoc);
                        if (confirmButton) {
                            tryClickElement(confirmButton, '确认原创');
                        }
                    }

                    // 等待上传完成（最多1分钟）
                    appendDebugInfo('等待上传完成...（最多等待1分钟）');
                    const uploadTimeout = 1 * 60 * 1000; // 1分钟
                    const checkInterval = 1000; // 每1秒检查一次
                    const startTime = Date.now();

                    // 上传完成的标识选择器
                    const successIndicators = [
                        '.tips_global'
                    ];

                    await wait(checkInterval);
                    let uploadSuccess = false;
                    let coverSuccess = false;

                    while (Date.now() - startTime < uploadTimeout) {
                        // 检查是否有成功标识
                        for (const selector of successIndicators) {
                            const successElement = findElement(selector, iframeDoc);
                            if (successElement && window.getComputedStyle(successElement).display !== 'none') {
                                appendDebugInfo('检测到上传成功标识');
                                uploadSuccess = true;
                                break;
                            }
                        }

                        // 检查页面是否包含封面选择按钮
                        // 1. 查找并点击封面编辑按钮，进入封面编辑界面
                        const coverEditSelectors = [
                            '.cover__options__item:nth-child(1)'
                        ];

                        const coverEdit = findElementWithMultipleSelectors(coverEditSelectors, iframeDoc);
                        if (coverEdit && !coverSuccess) {
                            // 设置封面才可以上传
                            // 检查页面是否包含封面准备好的关键词
                            appendDebugInfo('尝试设置封面...');

                            if (coverFile) {
                                // 使用提供的封面文件
                                appendDebugInfo(`准备使用提供的封面文件: ${coverFile.name}`);

                                // 1. 查点击封面编辑按钮，进入封面编辑界面
                                tryClickElement(coverEdit, '封面编辑按钮');

                                // 2. 查找并点击素材库按钮
                                appendDebugInfo('尝试打开素材库...');
                                const materialLibrarySelectors = [
                                    '.weui-desktop-uploader__info-area__btn',
                                    '.weui-desktop-btn.weui-desktop-btn_default'
                                ];

                                const materialLibraryBtn = findElementWithMultipleSelectors(materialLibrarySelectors, iframeDoc);
                                if (materialLibraryBtn) {
                                    tryClickElement(materialLibraryBtn, '素材库按钮');
                                    // await wait(2000);

                                    // 3. 查找并点击上传本地素材按钮
                                    appendDebugInfo('尝试上传本地素材...');
                                    const uploadLocalSelectors = [
                                        '.weui-desktop-upload_global-media input[type="file"][accept*="image"]'
                                    ];

                                    const uploadInput = findElementWithMultipleSelectors(uploadLocalSelectors, iframeDoc);
                                    if (uploadInput) {
                                        // 使用DataTransfer自动设置封面文件
                                        const dataTransfer = new DataTransfer();
                                        dataTransfer.items.add(coverFile);
                                        uploadInput.files = dataTransfer.files;

                                        // 触发change事件
                                        uploadInput.dispatchEvent(new Event('change', { bubbles: true }));
                                        appendDebugInfo(`已自动设置封面文件: ${coverFile.name}`);

                                        // 4. 等待文件上传完成
                                        appendDebugInfo('等待封面文件上传完成...');
                                        // 等待3秒让文件上传完成
                                        await wait(3000);

                                        // 每隔1秒监控“下一步”按钮是否可以点击以确认上传是否完成
                                        appendDebugInfo('尝试点击“下一步”按钮...');
                                        const nextStepSelectors = [
                                            '.weui-desktop-dialog_img-picker-with-crop .weui-desktop-dialog .weui-desktop-dialog__ft .weui-desktop-btn_wrp .weui-desktop-btn_primary'
                                        ];

                                        let nextStepBtn = findElementWithMultipleSelectors(nextStepSelectors, iframeDoc);
                                        while (!nextStepBtn || nextStepBtn.classList.contains('weui-desktop-btn_disabled')) {
                                            await wait(1000);
                                            nextStepBtn = findElementWithMultipleSelectors(nextStepSelectors, iframeDoc);
                                            if (!nextStepBtn) {
                                                appendDebugInfo('未找到“下一步”按钮');
                                                break;
                                            } else if (nextStepBtn.classList.contains('weui-desktop-btn_disabled')) {
                                                appendDebugInfo('封面上传中，“下一步”按钮尚不可点击');
                                            }
                                        }
                                        appendDebugInfo('封面上传完成，点击“下一步”按钮');
                                        tryClickElement(nextStepBtn, '下一步按钮');

                                        // 5. 等待封面截取完成
                                        appendDebugInfo('等待封面截取完成...');
                                        // 等待2秒让截取完成
                                        // await wait(5000);

                                        // 6. 确认封面设计
                                        appendDebugInfo('尝试确认封面设计...');
                                        const confirmCoverSelectors = [
                                            'div.weui-desktop-dialog__wrp.weui-desktop-dialog_img-picker.weui-desktop-dialog_img-picker-with-crop:not([style*="display: none"]) > div > div.weui-desktop-dialog__ft > div:nth-child(3) > button',
                                        ];

                                        confirmCoverBtn = findElementWithMultipleSelectors(confirmCoverSelectors, iframeDoc);
                                        if (confirmCoverBtn) {
                                            while (confirmCoverBtn.checkVisibility() || !coverSuccess) {
                                                await wait(1000);
                                                tryClickElement(confirmCoverBtn, '确认封面设计按钮');
                                                if (!confirmCoverBtn.checkVisibility()) {
                                                    appendDebugInfo('确认封面设计按钮已不可见');
                                                    coverSuccess = true;
                                                }
                                                appendDebugInfo('确认封面设计按钮尚不可点击');
                                            }
                                            appendDebugInfo('已确认封面设计');
                                            coverSuccess = true;
                                        } else {
                                            appendDebugInfo('未找到确认封面设计按钮');
                                        }
                                    } else {
                                        appendDebugInfo('未找到上传本地素材的输入框');
                                    }
                                } else {
                                    appendDebugInfo('未找到素材库按钮');
                                }

                            }
                        }


                        // 检查是否有错误
                        const pageText = iframeDoc.body.textContent;
                        if (pageText.includes('创建文件失败')) {
                            appendDebugInfo('检测到错误：创建文件失败 (200002)');
                            appendDebugInfo('这通常是由于路径问题或权限不足导致的');
                            appendDebugInfo('尝试解决方案：1. 确保文件路径没有特殊字符 2. 使用英文路径 3. 检查文件权限');
                            return false;
                        }

                        if (uploadSuccess && coverSuccess) break;

                        await wait(checkInterval);
                        appendDebugInfo('仍在等待上传完成...');
                    }

                    if (!uploadSuccess) {
                        appendDebugInfo('上传超时');
                        return false;
                    }

                    /**
                    // 点击提交按钮（如果有）
                    appendDebugInfo('尝试点击提交按钮...');
                    const submitButtonSelectors = [
                        '.video-setting__footer-btns-group .weui-desktop-btn_primary'
                    ];

                    const submitButton = findElementWithMultipleSelectors(submitButtonSelectors, iframeDoc);
                    if (submitButton) {
                        // 提交之前做页面跳转事件的捕捉，防止提交后页面跳转到其他页面，而是刷新当前页面，继续上传下一个视频
                        window.addEventListener('beforeunload', (e) => {
                            e.preventDefault();
                        });

                        tryClickElement(submitButton, '提交按钮');
                        while (submitButton.checkVisibility()) {
                            await wait(1000);
                            tryClickElement(submitButton, '提交按钮');
                            appendDebugInfo('提交按钮尚不可点击');
                        }

                        // 等待提交完成
                        appendDebugInfo('等待提交完成...');
                    }
                    */
                    // 点击“保存并发送”，进行发送配置
                    appendDebugInfo('尝试点击“保存并发送”按钮...');
                    const sendButtonSelectors = [
                        '.video-setting__footer-btns-group .video-save-send-btn .weui-desktop-btn_default'
                    ];

                    const sendButton = findElementWithMultipleSelectors(sendButtonSelectors, iframeDoc);
                    if (sendButton) {
                        // 提交之前做页面跳转事件的捕捉，防止提交后页面跳转到其他页面，而是刷新当前页面，继续上传下一个视频
                        window.addEventListener('beforeunload', (e) => {
                            e.preventDefault();
                        });

                        tryClickElement(sendButton, '“保存并发送”按钮');
                        while (sendButton.checkVisibility()) {
                            await wait(1000);
                            tryClickElement(sendButton, '“保存并发送”按钮');
                            appendDebugInfo('“保存并发送”按钮尚不可点击');
                        }

                        appendDebugInfo('发送配置页面加载完成');
                    }

                    appendDebugInfo(`视频 ${normalizedVideoFile.name} 上传完成！`);
                } catch (error) {
                    appendDebugInfo(`设置文件时出错: ${error.message}`);
                    // 降级方案：使用脚本注入
                    injectUploadScriptToIframe(iframe, normalizedVideoFile, normalizedCoverFile);
                }
            } else {
                appendDebugInfo('在iframe中找不到文件输入框，尝试使用脚本注入');
                injectUploadScriptToIframe(iframe, normalizedVideoFile, normalizedCoverFile);
            }
        }

        // 这里添加一个简化的上传状态检查逻辑
        // 实际使用时可能需要根据iframe中的页面状态进行更详细的检查
        // await wait(uploadTimeout);

        appendDebugInfo(`视频 ${normalizedVideoFile.name} 上传处理完成！`);

        // 关闭上传浮窗
        const uploadWindow = document.getElementById('chrome-upload-iframe-window');
        if (uploadWindow) {
            uploadWindow.remove();
        }

        return true;

    } catch (error) {
        console.error('上传视频时出错:', error);
        appendDebugInfo(`上传出错: ${error.message}`);
        return false;
    }
}

/**
 * 向iframe注入上传脚本
 * @param {HTMLIFrameElement} iframe - iframe元素
 * @param {File} videoFile - 视频文件
 * @param {File} coverFile - 封面文件（可选）
 */
function injectUploadScriptToIframe(iframe, videoFile, coverFile = null) {
    appendDebugInfo('向iframe注入上传脚本...');

    // 创建上传脚本
    const uploadScript = `
        console.log('微信公众号视频上传脚本已注入iframe');
        
        // 注入的脚本将在iframe中执行
        (async function() {
            // 显示上传状态信息
            function showUploadStatus(message) {
                console.log('[iframe上传状态]', message);
                // 这里可以添加自定义的状态显示逻辑
            }
            
            showUploadStatus('开始上传视频: ${videoFile.name.replace(/'/g, "\\'")}');
            ${coverFile ? `showUploadStatus('封面文件: ${coverFile.name.replace(/'/g, "\\'")}');` : ''}
            
            // 查找文件输入框
            const fileInput = document.querySelector('input[type="file"][accept*="video"]');
            
            if (fileInput) {
                showUploadStatus('找到文件输入框');
                
                // 创建一个新的input元素，用于触发文件选择对话框
                const hiddenInput = document.createElement('input');
                hiddenInput.type = 'file';
                hiddenInput.accept = 'video/*';
                hiddenInput.style.display = 'none';
                document.body.appendChild(hiddenInput);
                
                // 提示用户在iframe中选择文件
                showUploadStatus('请在弹出的上传窗口中选择文件: ${videoFile.name.replace(/'/g, "\\'")}');
                ${coverFile ? `showUploadStatus('封面上传提示: 视频上传成功后，请手动上传封面文件: ${coverFile.name.replace(/'/g, "\\'")}');` : ''}
                
                // 这里无法直接设置文件到iframe中，需要用户手动选择
                // 在实际使用中，可以考虑使用其他方式传递文件数据
            } else {
                showUploadStatus('找不到文件输入框');
            }
            
            // 这里可以根据实际需求添加更多的自动化操作逻辑
        })();
    `;

    try {
        // 创建script元素
        const script = iframe.contentDocument.createElement('script');
        script.textContent = uploadScript;

        // 将script元素添加到iframe的document中
        iframe.contentDocument.body.appendChild(script);
        appendDebugInfo('上传脚本已成功注入iframe');
    } catch (error) {
        appendDebugInfo(`注入脚本时出错: ${error.message}`);
        // 如果无法直接注入脚本，尝试使用postMessage与iframe通信
        try {
            iframe.contentWindow.postMessage({
                type: 'UPLOAD_VIDEO',
                fileName: videoFile.name,
                fileSize: videoFile.size,
                hasCover: !!coverFile,
                coverFileName: coverFile ? coverFile.name : null
            }, '*');
            appendDebugInfo('已发送上传消息到iframe');
        } catch (postMessageError) {
            appendDebugInfo(`发送消息时出错: ${postMessageError.message}`);
        }
    }
}

/**
 * 批量上传视频
 * @param {Array<File>} videoFiles - 视频文件数组
 */
async function batchUploadVideos(videoFiles) {
    if (!videoFiles || videoFiles.length === 0) {
        appendDebugInfo('没有选择视频文件');
        return;
    }

    appendDebugInfo(`开始批量上传 ${videoFiles.length} 个视频文件`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < videoFiles.length; i++) {
        // 支持两种格式：直接的文件对象或包含video和cover的对象
        const item = videoFiles[i];
        const videoFile = item.video || item;
        const coverFile = item.cover || null;

        appendDebugInfo(`\n--- 正在处理第 ${i + 1}/${videoFiles.length} 个视频 ---`);
        appendDebugInfo(`视频: ${videoFile.name}`);
        if (coverFile) {
            appendDebugInfo(`封面: ${coverFile.name}`);
        }

        const success = await uploadSingleVideo(videoFile, coverFile);

        if (success) {
            successCount++;
        } else {
            failCount++;
            appendDebugInfo(`视频 ${videoFile.name} 上传失败`);
        }
    }

    appendDebugInfo(`\n=== 批量上传完成 ===`);
    appendDebugInfo(`成功: ${successCount} 个，失败: ${failCount} 个`);
    // 上传完成后，刷新视频列表页
    if (isVideoListPage()) {
        appendDebugInfo('成功上传视频后，请刷新页面查看...');
        location.reload();
    }
}

// 重复定义的isVideoListPage已移除（保留原始实现）

/**
 * 创建上传浮窗（使用iframe）
 */
// 重复的createUploadIframe已移除（保留后面的唯一版本）

/** 
 * 获取文件名的基础名称（不包含扩展名、特殊符号、数字、中文括号等） 
 */
// 重复的getBaseName已移除（保留前面的唯一版本）

/**
 * 初始化悬浮按钮
 */
function initChromeDebugUploader() {
    // 检查是否在视频列表页
    if (!isVideoListPage()) {
        console.log('当前页面不是视频列表页，脚本将不会初始化');
        showDebugInfo('请在微信公众号的视频列表页运行此脚本');
        return;
    }

    // 检查是否已存在悬浮按钮
    if (document.getElementById('chrome-video-uploader-container')) {
        console.log('悬浮按钮已存在，无需重复创建');
        return;
    }

    // 创建悬浮按钮容器
    const container = document.createElement('div');
    container.id = 'chrome-video-uploader-container';
    container.style.display = 'inline';

    // 创建调试信息区域
    const debugInfo = document.createElement('div');
    debugInfo.id = 'chrome-debug-info';
    debugInfo.style.marginBottom = '10px';
    debugInfo.style.padding = '10px';
    debugInfo.style.backgroundColor = '#f5f5f5';
    debugInfo.style.borderRadius = '4px';
    debugInfo.style.minHeight = '60px';
    debugInfo.style.fontSize = '12px';
    debugInfo.style.textAlign = 'left';
    debugInfo.style.whiteSpace = 'pre-wrap';
    debugInfo.style.fontFamily = 'monospace';
    debugInfo.textContent = '调试信息：等待选择视频文件或目录...';

    // 创建选择视频文件按钮
    const selectFileButton = document.createElement('button');
    selectFileButton.id = 'chrome-select-files-btn';
    selectFileButton.classList.add('weui-desktop-btn', 'weui-desktop-btn_primary');
    selectFileButton.style.backgroundColor = '#4CAF50';
    selectFileButton.style.marginLeft = '10px';
    selectFileButton.textContent = '上传多文件';

    // 创建选择视频目录按钮
    const selectDirButton = document.createElement('button');
    selectDirButton.id = 'chrome-select-dir-btn';
    selectDirButton.classList.add('weui-desktop-btn', 'weui-desktop-btn_primary');
    selectDirButton.style.backgroundColor = '#2196F3';
    selectDirButton.style.marginLeft = '10px';
    selectDirButton.textContent = '上传目录';

    // 创建隐藏的文件输入框
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'chrome-file-selector';
    fileInput.accept = 'video/*,image/png';
    fileInput.multiple = true;
    fileInput.style.display = 'none';

    // 创建隐藏的目录选择输入框
    const dirInput = document.createElement('input');
    dirInput.type = 'file';
    dirInput.id = 'chrome-dir-selector';
    dirInput.webkitdirectory = true;
    dirInput.style.display = 'none';

    // 创建删除本页视频按钮
    const deleteDirButton = document.createElement('button');
    deleteDirButton.classList.add('weui-desktop-btn', 'weui-desktop-btn_primary');
    deleteDirButton.style.backgroundColor = '#2196F3';
    deleteDirButton.style.marginLeft = '10px';
    deleteDirButton.textContent = '删除本页';
    // 添加ID属性，方便在clearUploadedVideos函数中选择
    deleteDirButton.id = 'deleteDirButton';
    deleteDirButton.setAttribute('data-action', 'delete-videos');

    // 创建删除非原创视频按钮
    const deleteNonOriginalButton = document.createElement('button');
    deleteNonOriginalButton.classList.add('weui-desktop-btn', 'weui-desktop-btn_primary');
    deleteNonOriginalButton.style.backgroundColor = '#2196F3';
    deleteNonOriginalButton.style.marginLeft = '10px';
    deleteNonOriginalButton.textContent = '删除非原创';
    deleteNonOriginalButton.id = 'deleteNonOriginalButton';
    deleteNonOriginalButton.setAttribute('data-action', 'delete-non-original-videos');

    // 组装元素
    container.appendChild(selectFileButton);
    container.appendChild(selectDirButton);
    container.appendChild(fileInput);
    container.appendChild(dirInput);
    container.appendChild(deleteDirButton);
    container.appendChild(deleteNonOriginalButton);
    // container.appendChild(debugInfo);

    // 添加到目标元素后面
    if (new Date().getTime() < new Date('2025-12-04').getTime()) {
        const targetElement = document.querySelector('#app > div.weui-desktop-block > div.weui-desktop-block__main > div > div:nth-child(1) > div.weui-desktop-panel__hd.weui-desktop-global-mod > div.weui-desktop-global__extra > div.weui-desktop-btn_wrp');
        if (targetElement) {
            targetElement.parentNode.insertBefore(container, targetElement.nextSibling);
        } else {
            console.error('目标元素未找到');
            document.body.appendChild(container);
        }
    }

    // 添加事件监听
    selectFileButton.addEventListener('click', () => {
        console.log('点击选择文件按钮');
        showDebugInfo('按钮被点击，触发文件选择器...');
        fileInput.click();
    });

    selectDirButton.addEventListener('click', () => {
        console.log('点击选择目录按钮');
        showDebugInfo('按钮被点击，触发目录选择器...');
        dirInput.click();
    });

    fileInput.addEventListener('change', async () => {
        console.log('文件选择发生变化');
        const files = Array.from(fileInput.files);

        if (files.length > 0) {
            showDebugInfo(`已选择 ${files.length} 个文件\n`);

            // 显示前3个文件的信息
            files.slice(0, 3).forEach((file, index) => {
                appendDebugInfo(`文件 ${index + 1}: ${file.name}`);
                appendDebugInfo(`大小: ${(file.size / (1024 * 1024)).toFixed(2)} MB`);
                appendDebugInfo(`类型: ${file.type || '未知'}`);
            });

            if (files.length > 3) {
                appendDebugInfo(`... 还有 ${files.length - 3} 个文件`);
            }

            // 分离视频文件和PNG封面图片，并建立对应关系
            let videoFiles = [];
            const coverMap = new Map(); // 用于存储视频文件名到封面图片的映射

            // 先收集所有PNG图片
            files.forEach(file => {
                if (file.name.toLowerCase().endsWith('.png')) {
                    const normalizedFile = createNormalizedFile(file);
                    const baseName = normalizedFile.name.replace(/\.png$/i, '');
                    coverMap.set(baseName.toLowerCase(), normalizedFile);
                    appendDebugInfo(`找到封面图片: ${normalizedFile.name}`);
                }
            });

            // 然后收集视频文件并匹配封面
            files.forEach(file => {
                if (file.type.startsWith('video/')) {
                    const normalizedFile = createNormalizedFile(file);
                    const baseName = normalizedFile.name.replace(/\.[^/.]+$/, '');
                    const matchingCover = coverMap.get(baseName.toLowerCase());

                    if (matchingCover) {
                        appendDebugInfo(`视频 ${normalizedFile.name} 匹配到封面图片: ${matchingCover.name}`);
                        videoFiles.push({ video: normalizedFile, cover: matchingCover });
                    } else {
                        appendDebugInfo(`视频 ${normalizedFile.name} 没有找到匹配的封面图片`);
                        videoFiles.push({ video: normalizedFile, cover: null });
                    }
                }
            });

            // 历史记录查重
            const history = await ensureHistoryRecordsReady();
            appendDebugInfo(`历史视频素材记录收集完成，共 ${history.length} 条`);
            const titleSet = new Set(history.map(h => normalizeComparableTitle(h.title)));
            const duplicates = [];
            const filtered = [];
            for (const item of videoFiles) {
                const baseKey = normalizeComparableTitle(item.video.name);
                if (titleSet.has(baseKey)) {
                    const match = history.find(h => normalizeComparableTitle(h.title) === baseKey);
                    duplicates.push({ file: item.video.name, title: (match && match.title) || '', time: (match && match.publish_time) || '' });
                } else {
                    filtered.push(item);
                }
            }
            if (duplicates.length > 0) {
                appendDebugInfo(`检测到历史重复 ${duplicates.length} 项`);
                const sample = duplicates.slice(0, 10).map(d => `${d.file} ≈ ${d.title}`).join('\n');
                const skip = confirm(`检测到 ${duplicates.length} 个可能重复的视频：\n${sample}\n选择“确定”跳过重复，或“取消”继续上传。`);
                if (skip) {
                    videoFiles = filtered;
                    appendDebugInfo(`已跳过重复，剩余 ${videoFiles.length} 个待上传`);
                } else {
                    appendDebugInfo('用户选择继续上传包含重复的视频');
                }
            } else {
                appendDebugInfo('未检测到历史重复视频');
            }

            if (videoFiles.length === 0) {
                appendDebugInfo('未找到有效的视频文件');
                alert('请选择有效的视频文件');
                return;
            }

            appendDebugInfo(`\n筛选出 ${videoFiles.length} 个视频文件，准备上传`);

            // 开始上传
            await batchUploadVideos(videoFiles);
        } else {
            showDebugInfo('未选择任何文件');
        }
    });

    dirInput.addEventListener('change', async () => {
        console.log('目录选择发生变化');
        const files = Array.from(dirInput.files);

        if (files.length > 0) {
            showDebugInfo(`已选择目录中的 ${files.length} 个文件\n`);

            // 显示前3个文件的信息
            files.slice(0, 3).forEach((file, index) => {
                appendDebugInfo(`文件 ${index + 1}: ${file.name}`);
                appendDebugInfo(`大小: ${(file.size / (1024 * 1024)).toFixed(2)} MB`);
                appendDebugInfo(`类型: ${file.type || '未知'}`);
            });

            if (files.length > 3) {
                appendDebugInfo(`... 还有 ${files.length - 3} 个文件`);
            }

            // 分离视频文件和PNG封面图片，并建立对应关系
            let videoFiles = [];
            const coverMap = new Map(); // 用于存储视频文件名到封面图片的映射

            // 先收集所有PNG、JPG图片
            files.forEach(file => {
                if (file.name.toLowerCase().endsWith('.png') || file.name.toLowerCase().endsWith('.jpg')) {
                    const normalizedFile = createNormalizedFile(file);
                    const baseName = getBaseName(normalizedFile);
                    coverMap.set(baseName.toLowerCase(), normalizedFile);
                    appendDebugInfo(`找到封面图片: ${normalizedFile.name}`);
                }
            });

            // 然后收集视频文件并匹配封面
            files.forEach(file => {
                if (file.type.startsWith('video/')) {
                    const normalizedFile = createNormalizedFile(file);
                    const baseName = getBaseName(normalizedFile);
                    const matchingCover = coverMap.get(baseName.toLowerCase());

                    if (matchingCover) {
                        appendDebugInfo(`视频 ${normalizedFile.name} 匹配到封面图片: ${matchingCover.name}`);
                        videoFiles.push({ video: normalizedFile, cover: matchingCover });
                    } else {
                        appendDebugInfo(`视频 ${normalizedFile.name} 没有找到匹配的封面图片`);
                        videoFiles.push({ video: normalizedFile, cover: null });
                    }
                }
            });

            // 历史记录查重
            const history = await ensureHistoryRecordsReady();
            appendDebugInfo(`历史视频素材记录收集完成，共 ${history.length} 条`);
            const titleSet = new Set(history.map(h => h.title));
            appendDebugInfo('标题集：' + Array.from(titleSet).join(', '));
            const duplicates = [];
            const filtered = [];
            for (const item of videoFiles) {
                const baseKey = normalizeComparableTitle(item.video.name);
                appendDebugInfo(`根据视频标题 ${baseKey} 检查视频 ${item.video.name} 是否重复...`);
                if (titleSet.has(baseKey)) {
                    const match = history.find(h => h.title === baseKey);
                    duplicates.push({ file: item.video.name, title: (match && match.title) || '', time: (match && match.publish_time) || '' });
                } else {
                    filtered.push(item);
                }
            }
            if (duplicates.length > 0) {
                appendDebugInfo(`检测到历史重复 ${duplicates.length} 项`);
                const sample = duplicates.slice(0, 10).map(d => `${d.file} ≈ ${d.title}`).join('\n');
                const skip = confirm(`检测到 ${duplicates.length} 个可能重复的视频：\n${sample}\n选择“确定”跳过重复，或“取消”继续上传。`);
                if (skip) {
                    videoFiles = filtered;
                    appendDebugInfo(`已跳过重复，剩余 ${videoFiles.length} 个待上传`);
                } else {
                    appendDebugInfo('用户选择继续上传包含重复的视频');
                }
            } else {
                appendDebugInfo('未检测到历史重复视频');
            }

            if (videoFiles.length === 0) {
                appendDebugInfo('所选目录中未找到有效的视频文件');
                alert('所选目录中未找到有效的视频文件');
                return;
            }

            appendDebugInfo(`\n筛选出 ${videoFiles.length} 个视频文件，准备上传`);

            // 开始上传
            await batchUploadVideos(videoFiles);
        } else {
            showDebugInfo('未选择任何目录或文件');
        }
    });

    deleteDirButton.addEventListener('click', () => {
        console.log('点击删除本页视频按钮');
        showDebugInfo('按钮被点击，删除本页视频...');
        // 清空上传的视频列表
        clearUploadedVideos();
    });

    deleteNonOriginalButton.addEventListener('click', () => {
        console.log('点击删除非原创视频按钮');
        showDebugInfo('按钮被点击，删除非原创视频...');
        // 调用删除非原创视频的函数
        deleteNonOriginalVideos();
    });

    console.log('Chrome调试工具视频上传悬浮按钮已成功创建');
    showDebugInfo('悬浮按钮已创建完成，请点击"选择视频文件"按钮开始上传');
}

// 当页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChromeDebugUploader);
} else {
    // 页面已经加载完成，直接初始化
    initChromeDebugUploader();
}

// 导出主要函数，方便在控制台手动调用
window.ChromeVideoUploader = {
    init: initChromeDebugUploader,
    uploadVideo: uploadSingleVideo,
    batchUploadVideos: batchUploadVideos,
    showDebugInfo: showDebugInfo,
    appendDebugInfo: appendDebugInfo,
    normalizeFileName: normalizeFileName,
    createNormalizedFile: createNormalizedFile
};

// 提取当前页面token
function getCurrentToken() {
    return getParamFromUrl(window.location.href, 'token') || null;
}

// 将标题规范化为可比较的键（与getBaseName一致策略：仅保留中文，去括号）
function normalizeComparableTitle(text) {
    if (!text) return '';
    let s = text.trim();
    s = s.replace(/\.[^\/.]+$/, '');
    return s.toLowerCase();
}

// 抓取历史视频素材发表记录（最多maxCount条）
async function fetchVideoHistoryRecords(maxCount = 200) {
    const token = getCurrentToken();
    if (!token) { appendDebugInfo('无法获取token，历史记录抓取跳过'); return []; }
    const pageSize = 50;
    const records = [];
    for (let begin = 0; begin < maxCount; begin += pageSize) {
        const url = `https://mp.weixin.qq.com/cgi-bin/appmsg?action=list_video&t=media/video_list&type=15&begin=${begin}&count=${pageSize}&token=${token}&lang=zh_CN&f=json&ajax=1`;
        try {
            const resp = await fetch(url, { credentials: 'include' });
            const data = await resp.json();
            const items = data && data.app_msg_info && Array.isArray(data.app_msg_info.item) ? data.app_msg_info.item : null;
            if (!items || items.length === 0) break;
            appendDebugInfo(`抓取历史记录第 ${begin} 条开始，共 ${items.length} 条`);
            for (const it of items) {
                const title = (it.title || it.appmsg_title || '').trim();
                const publish_time = it.create_time || it.update_time || it.time || null;
                const is_non_original = it.multi_item && Array.isArray(it.multi_item) && it.multi_item.length > 0 ? it.multi_item[0].video_ori_status === 2 ? 1 : 0 : 0;
                const app_id = it.app_id || '';
                records.push({ title, publish_time, is_non_original, app_id });
            }
            if (records.length >= maxCount) {
                appendDebugInfo(`已抓取到 ${maxCount} 条历史记录，停止抓取`);
                break;
            }
        } catch (e) {
            appendDebugInfo(`抓取历史记录失败: ${e.message}`);
            break;
        }
    }
    window.__wxVideoHistoryRecords = records;
    try { localStorage.setItem('wxVideoHistoryRecords', JSON.stringify({ ts: Date.now(), records })); } catch { }
    appendDebugInfo(`历史视频素材记录收集完成，共 ${records.length} 条`);
    return records;
}

async function ensureHistoryRecordsReady() {
    const confirm = window.confirm('是否抓取历史视频素材发表记录？（最多200条）');
    if (!confirm) {
        appendDebugInfo('用户选择不抓取历史记录，跳过');
        return [];
    }
    return await fetchVideoHistoryRecords(200);
}

// 重复定义的batchUploadVideos已移除（保留原始实现）

/**
 * 检查是否在视频列表页
 */
function isVideoListPage() {
    // 检查URL或页面元素是否符合视频列表页特征
    const url = window.location.href;
    const pageContainsVideoList = document.body.innerText.includes('视频列表') ||
        document.body.innerText.includes('video list');

    return url.includes('mp.weixin.qq.com') && (url.includes('video') || pageContainsVideoList);
}

/**
 * 创建上传浮窗（使用iframe）
 */
function createUploadIframe(videoFile) {
    // 检查是否已存在上传浮窗
    let uploadWindow = document.getElementById('chrome-upload-iframe-window');

    if (uploadWindow) {
        // 如果浮窗已存在，则移除它
        uploadWindow.remove();
    }

    // 创建浮窗容器
    uploadWindow = document.createElement('div');
    uploadWindow.id = 'chrome-upload-iframe-window';
    uploadWindow.style.position = 'fixed';
    uploadWindow.style.top = '50%';
    uploadWindow.style.left = '50%';
    uploadWindow.style.transform = 'translate(-50%, -50%)';
    uploadWindow.style.zIndex = '10000';
    uploadWindow.style.width = '80%';
    uploadWindow.style.height = '80%';
    uploadWindow.style.backgroundColor = 'white';
    uploadWindow.style.border = '2px solid #4CAF50';
    uploadWindow.style.borderRadius = '10px';
    uploadWindow.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.5)';
    uploadWindow.style.overflow = 'hidden';

    // 创建浮窗标题栏
    const titleBar = document.createElement('div');
    titleBar.style.backgroundColor = '#4CAF50';
    titleBar.style.color = 'white';
    titleBar.style.padding = '10px 15px';
    titleBar.style.fontWeight = 'bold';
    titleBar.style.display = 'flex';
    titleBar.style.justifyContent = 'space-between';
    titleBar.style.alignItems = 'center';
    titleBar.textContent = `正在上传: ${videoFile.name}`;

    // 创建关闭按钮
    const closeButton = document.createElement('button');
    closeButton.style.backgroundColor = 'transparent';
    closeButton.style.color = 'white';
    closeButton.style.border = 'none';
    closeButton.style.fontSize = '20px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.padding = '0';
    closeButton.style.width = '30px';
    closeButton.style.height = '30px';
    closeButton.style.display = 'flex';
    closeButton.style.alignItems = 'center';
    closeButton.style.justifyContent = 'center';
    closeButton.textContent = '×';

    closeButton.addEventListener('click', () => {
        uploadWindow.remove();
    });

    titleBar.appendChild(closeButton);

    // 创建iframe容器
    const iframeContainer = document.createElement('div');
    iframeContainer.style.width = '100%';
    iframeContainer.style.height = 'calc(100% - 40px)';

    // 创建iframe
    const iframe = document.createElement('iframe');
    iframe.id = 'chrome-upload-iframe';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.background = '#f5f5f5';

    // 从当前页面URL提取token
    function extractTokenFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        let token = urlParams.get('token');

        // 如果直接从URL参数中获取不到，尝试从完整URL中提取
        if (!token) {
            const tokenMatch = window.location.href.match(/token=([^&]+)/);
            if (tokenMatch && tokenMatch[1]) {
                token = tokenMatch[1];
            }
        }

        return token;
    }

    // 设置iframe的源URL（视频上传页）
    const token = extractTokenFromUrl();
    if (token) {
        iframe.src = `https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/videomsg_edit&action=video_edit&type=15&isNew=1&token=${token}&lang=zh_CN`;
        appendDebugInfo(`已从当前页面提取token并设置上传地址`);
    } else {
        // 如果无法提取token，使用默认地址
        iframe.src = 'https://mp.weixin.qq.com/cgi-bin/appmsgvideo?action=upload_video';
        appendDebugInfo('无法从当前页面提取token，使用默认上传地址');
    }

    iframeContainer.appendChild(iframe);
    uploadWindow.appendChild(titleBar);
    uploadWindow.appendChild(iframeContainer);

    // 添加到页面
    document.body.appendChild(uploadWindow);

    return iframe;
}

/** 
 * 获取文件名的基础名称（不包含扩展名、特殊符号、数字、中文括号等） 
 */
function getBaseName(file) {
    // 隐藏日志输出
    // console.log(`原始文件名: ${file.name}`);
    // 移除扩展名
    let baseName = file.name.replace(/\.[^/.]+$/, '');
    // console.log(`移除扩展名后的文件名: ${baseName}`);
    // 移除所有非中文字符
    baseName = baseName.replace(/[^\u4e00-\u9fa5]/g, '');
    // console.log(`移除所有非中文字符后的文件名: ${baseName}`);
    // 移除所有中文括号
    baseName = baseName.replace(/[（）]/g, '');
    // console.log(`移除所有中文括号后的文件名: ${baseName}`);
    return baseName;
}

/**
 * 初始化悬浮按钮
 */
// 重复的初始化函数已移除（保留前面的唯一版本）

// 重复的初始化与导出已移除（保留前面的唯一版本）
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const puppeteer = require('puppeteer');

// 配置信息
const config = {
    videoDir: './articles-videos', // 视频文件目录
    headless: false, // 是否无头模式，开发阶段设为false便于调试
    delayBetweenUploads: 2000, // 上传间隔时间(毫秒)，避免触发频率限制
    maxRetries: 3 // 失败重试次数
};

// 存储登录后的token
let WECHAT_MP_TOKEN = '';

// 日志记录
const log = (message) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
};

// 获取视频文件列表
const getVideoFiles = (dir) => {
    try {
        if (!fs.existsSync(dir)) {
            log(`警告：视频目录不存在: ${dir}`);
            return [];
        }
        
        const files = fs.readdirSync(dir)
            .filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ['.mp4', '.mov', '.avi', '.flv', '.wmv', '.mkv'].includes(ext);
            })
            .map(file => path.join(dir, file));
            
        log(`在目录 ${dir} 中找到 ${files.length} 个视频文件`);
        files.forEach(file => log(`  - ${file}`));
        
        return files;
    } catch (error) {
        log(`获取视频文件列表时出错: ${error.message}`);
        return [];
    }
};

// 等待用户扫码登录
const waitForLogin = async (page) => {
    log('请在浏览器中扫码登录微信公众号...');
    
    // 添加更健壮的登录检测机制
    // 1. 先检查当前是否已经有token或者是否已经登录
    let currentUrl = page.url();
    let tokenMatch = currentUrl.match(/token=([^&]+)/);
    
    if (tokenMatch && tokenMatch[1]) {
        WECHAT_MP_TOKEN = tokenMatch[1];
        log(`已检测到现有token: ${WECHAT_MP_TOKEN}`);
        log('登录成功！');
        return;
    }
    
    // 2. 尝试等待页面跳转（最多等待2分钟）
    try {
        log('等待页面跳转以获取登录状态...');
        await page.waitForNavigation({
            waitUntil: 'networkidle0',
            timeout: 120000 // 2分钟超时
        });
        
        // 获取URL中的token参数
        currentUrl = page.url();
        tokenMatch = currentUrl.match(/token=([^&]+)/);
        if (tokenMatch && tokenMatch[1]) {
            WECHAT_MP_TOKEN = tokenMatch[1];
            log(`成功获取token: ${WECHAT_MP_TOKEN}`);
            log('登录成功！');
            return;
        }
    } catch (e) {
        log(`等待页面跳转超时: ${e.message}`);
    }
    
    // 3. 如果页面没有跳转，检查页面内容是否表示已登录
    log('检查页面内容以确定登录状态...');
    const isLoggedIn = await page.evaluate(() => {
        // 检查页面是否包含表示已登录的元素或文本
        const loggedInIndicators = [
            '首页',
            '素材管理',
            '内容创作',
            '已登录',
            '我的账号'
        ];
        
        const pageContent = document.body.textContent.toLowerCase();
        return loggedInIndicators.some(indicator => pageContent.includes(indicator.toLowerCase()));
    });
    
    if (isLoggedIn) {
        // 再次尝试从当前URL获取token
        currentUrl = page.url();
        tokenMatch = currentUrl.match(/token=([^&]+)/);
        if (tokenMatch && tokenMatch[1]) {
            WECHAT_MP_TOKEN = tokenMatch[1];
            log(`成功获取token: ${WECHAT_MP_TOKEN}`);
        }
        log('登录成功！');
    } else {
        log('警告：未能确认登录状态。如果您已经登录，请刷新页面并重试。');
    }
};

// 等待函数，替代已弃用的page.waitForTimeout
const wait = (ms) => new Promise(r => setTimeout(r, ms));

// 上传单个视频
const uploadVideo = async (page, videoPath, retries = 0) => {
    try {
        const fileName = path.basename(videoPath);
        const videoTitle = path.basename(videoPath, path.extname(videoPath));
        
        // 清理文件路径，确保它是绝对路径并且格式正确
        let cleanVideoPath = videoPath;
        if (cleanVideoPath.includes('\\') && process.platform === 'darwin') {
            // 修复在Mac上混合的Windows路径
            cleanVideoPath = cleanVideoPath.replace(/\\/g, '/');
            // 如果路径包含C:/，尝试从路径中提取有效的Mac路径
            if (cleanVideoPath.includes('C:/')) {
                const pathParts = cleanVideoPath.split('/');
                // 尝试找到最后一个视频文件名
                const videoIndex = pathParts.findIndex(part => part.includes('.mp4'));
                if (videoIndex !== -1) {
                    // 构建相对路径
                    cleanVideoPath = path.join('./articles-videos', pathParts.slice(videoIndex).join('/'));
                    log(`修正文件路径: ${cleanVideoPath}`);
                }
            }
        }
        
        log(`开始上传视频: ${fileName}`);
        log(`使用的文件路径: ${cleanVideoPath}`);
        
        // 检查文件是否存在
        if (!fs.existsSync(cleanVideoPath)) {
            throw new Error(`文件不存在: ${cleanVideoPath}`);
        }
        
        // 检查当前页面是否已经在素材管理页面，避免重复导航
        const currentUrl = await page.url();
        const materialPageUrl = `https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/videomsg_edit&action=video_edit&type=15&isNew=1&token=${WECHAT_MP_TOKEN}`;
        
        if (!currentUrl.includes('videomsg_edit')) {
            await page.goto(materialPageUrl);
            log('素材管理页面加载中...');
            await wait(5000);
        } else {
            log('已在素材管理页面，刷新以确保状态正确...');
            await page.reload();
            await wait(3000);
        }
        
        // 等待页面加载完成
        await page.waitForSelector('body', { visible: true });
        log('素材管理页面已加载完成');
        
        try {
            // 尝试点击"视频"按钮，使用多种选择器尝试
            log('尝试点击视频按钮...');
            
            // 尝试更多通用的选择器
            const videoSelectors = [
                'input[name="vid"]',
                'a[data-type="video"]',
                'a[href*="type=10"]',
                'a:has(.icon_video)',
                'button:contains("视频")',
                '.nav-item:contains("视频")',
                '.menu-item:contains("视频")',
                '#menu-item-video',
                '.tab-item:contains("视频")',
                '[data-tab="video"]'
            ];
            
            let videoButtonFound = false;
            for (const selector of videoSelectors) {
                try {
                    log(`尝试选择器: ${selector}`);
                    await page.waitForSelector(selector, { timeout: 3000 });
                    await page.click(selector);
                    videoButtonFound = true;
                    log('视频按钮点击成功');
                    break;
                } catch (e) {
                    log(`选择器 ${selector} 未找到: ${e.message}`);
                }
            }
            
            if (!videoButtonFound) {
                // 获取页面部分内容以便调试
                const pageTitle = await page.title();
                log(`当前页面标题: ${pageTitle}`);
                
                // 尝试查找所有包含"视频"文本的元素
                const videoElements = await page.$$eval('*', el => el.filter(e => e.textContent && e.textContent.includes('视频')).map(e => e.tagName + ' ' + (e.id ? '#' + e.id : '') + ' ' + (e.className ? '.' + e.className.split(' ').join('.') : '')));
                log(`找到包含"视频"文本的元素数量: ${videoElements.length}`);
                if (videoElements.length > 0) {
                    log('包含"视频"文本的前5个元素:');
                    videoElements.slice(0, 5).forEach((el, index) => log(`  ${index + 1}. ${el}`));
                }
                
                throw new Error('未能找到视频按钮，请检查页面结构或选择器');
            }
            
            await wait(3000);
            
            // 点击"上传视频"按钮，尝试更多选择器
            log('尝试点击上传视频按钮...');
            const uploadSelectors = [
                'a#file-upload',
                'button:contains("上传视频")',
                'a:contains("上传视频")',
                '.upload-btn',
                '.file-upload-btn',
                'input[type="file"]',
                '[data-action="upload"]',
                '.upload-area',
                '#upload-video-button'
            ];
            
            let uploadButtonFound = false;
            for (const selector of uploadSelectors) {
                try {
                    log(`尝试选择器: ${selector}`);
                    
                    // 对于input[type="file"]类型，我们不点击而是直接使用
            if (selector === 'input[type="file"]') {
                const fileInput = await page.$(selector);
                if (fileInput) {
                    uploadButtonFound = true;
                    log('找到文件上传输入框');
                    // 保存文件上传输入框引用
                    page.fileInput = fileInput;
                    break;
                }
                continue;
            }
                    
                    await page.waitForSelector(selector, { timeout: 3000 });
                    await page.click(selector);
                    uploadButtonFound = true;
                    log('上传视频按钮点击成功');
                    break;
                } catch (e) {
                    log(`选择器 ${selector} 未找到: ${e.message}`);
                }
            }
            
            if (!uploadButtonFound) {
                // 尝试直接查找文件输入框
                const fileInput = await page.$('input[type="file"]');
                if (fileInput) {
                    uploadButtonFound = true;
                    log('直接找到文件上传输入框');
                    // 保存文件上传输入框引用
                    page.fileInput = fileInput;
                } else {
                    throw new Error('未能找到上传视频按钮或文件输入框，请检查页面结构');
                }
            }
            
            await wait(2000);
        } catch (error) {
            // 捕获并记录选择器相关的错误
            log(`页面操作失败: ${error.message}`);
            throw error;
        }
        
        // 处理文件上传
        let fileInput = null;
        
        // 尝试使用更通用的选择器查找文件上传控件，不依赖之前保存的引用
        log('尝试使用通用选择器查找文件上传控件...');
        const fileInputSelectors = [
            'input[type="file"]',
            'input[type="file"][name="file"]',
            'input[type="file"][name="vid"]',
            'input[type="file"][accept="video/*"]'
        ];
        
        for (const selector of fileInputSelectors) {
            try {
                log(`尝试选择器: ${selector}`);
                await page.waitForSelector(selector, { timeout: 2000 });
                fileInput = await page.$(selector);
                if (fileInput) {
                    log(`找到文件上传控件: ${selector}`);
                    break;
                }
            } catch (e) {
                log(`选择器 ${selector} 查找失败: ${e.message}`);
            }
        }
        
        if (!fileInput) {
            // 打印页面上所有的input[type="file"]元素信息用于调试
            const allFileInputs = await page.$$eval('input[type="file"]', inputs => 
                inputs.map(input => `${input.tagName} type="${input.type}" name="${input.name}" id="${input.id}" class="${input.className}"`)
            );
            log(`页面上找到的文件上传输入框数量: ${allFileInputs.length}`);
            if (allFileInputs.length > 0) {
                log('文件上传输入框详情:');
                allFileInputs.forEach((input, index) => log(`  ${index + 1}. ${input}`));
            } else {
                // 如果找不到文件输入框，尝试找到上传区域并点击
                const uploadAreaSelectors = [
                    '.upload-area',
                    '.upload-container',
                    '.drag-drop-area'
                ];
                
                for (const selector of uploadAreaSelectors) {
                    try {
                        log(`尝试点击上传区域: ${selector}`);
                        await page.waitForSelector(selector, { timeout: 2000 });
                        await page.click(selector);
                        log(`成功点击上传区域: ${selector}`);
                        await wait(2000);
                        // 再次尝试查找文件输入框
                        fileInput = await page.$('input[type="file"]');
                        if (fileInput) {
                            log('在点击上传区域后找到文件上传控件');
                            break;
                        }
                    } catch (e) {
                        log(`点击上传区域失败: ${e.message}`);
                    }
                }
            }
            
            if (!fileInput) {
                throw new Error('未找到文件上传控件');
            }
        }
        
        // 上传文件，使用try-catch捕获可能的文件上传错误
        try {
            // 尝试使用cleanVideoPath上传文件
            await fileInput.uploadFile(cleanVideoPath);
            log(`文件 ${fileName} 开始上传...`);
        } catch (uploadError) {
            log(`文件上传出错: ${uploadError.message}`);
            
            // 如果出现文件路径相关错误，尝试使用原始的videoPath
            if (uploadError.message.includes('no such file') && cleanVideoPath !== videoPath) {
                log(`尝试使用原始路径上传: ${videoPath}`);
                await fileInput.uploadFile(videoPath);
                log(`文件 ${fileName} 开始上传...`);
            } else if (uploadError.message.includes('create file failed') || uploadError.message.includes('200002')) {
                // 专门处理创建文件失败错误
                log(`创建文件失败，错误代码: 200002，可能是路径或权限问题`);
                log(`当前工作目录: ${process.cwd()}`);
                log(`文件绝对路径: ${path.resolve(cleanVideoPath)}`);
                throw new Error(`创建文件失败 (200002): ${uploadError.message}`);
            } else {
                throw uploadError;
            }
        }
        
        // 等待上传完成，使用多种选择器和策略
        log('等待文件上传完成...');
        
        // 先尝试使用多种可能的上传完成状态选择器
        const uploadCompleteSelectors = [
            '.tips_global:contains("视频上传成功")',
            '.upload-success',
            '.upload-status:contains("完成")',
            '.progress-container:has(.progress-100)',
            '.progress-bar[style*="width: 100%"]',
            '.success-info',
            '.upload-done',
            '.upload-finished',
            'div:contains("上传成功")',
            '.upload-status-text:contains("成功")'
        ];
        
        // 检查页面文本中是否包含成功关键词的函数
        const checkPageForSuccessText = async () => {
            try {
                const pageText = await page.evaluate(() => document.body.innerText);
                const successKeywords = ['上传成功', '添加成功', '视频上传完成', '素材已添加'];
                for (const keyword of successKeywords) {
                    if (pageText.includes(keyword)) {
                        log(`检测到页面文本中包含成功关键词: ${keyword}`);
                        return true;
                    }
                }
                return false;
            } catch (e) {
                log(`检查页面文本时出错: ${e.message}`);
                return false;
            }
        };
        
        let uploadCompleteFound = false;
        const startTime = Date.now();
        const timeout = 300000; // 5分钟超时
        
        // 循环检测直到超时或检测到上传完成
        while (!uploadCompleteFound && Date.now() - startTime < timeout) {
            // 尝试使用选择器方法检测上传完成
            for (const selector of uploadCompleteSelectors) {
                try {
                    log(`尝试检测上传完成状态: ${selector}`);
                    // 使用较短的超时时间以便更快地尝试其他方法
                    await page.waitForSelector(selector, { timeout: 10000 });
                    uploadCompleteFound = true;
                    log(`检测到上传完成状态: ${selector}`);
                    break;
                } catch (e) {
                    // 不记录每个选择器的失败信息，避免日志过于冗长
                }
            }
            
            // 如果选择器检测失败，尝试检查页面文本
            if (!uploadCompleteFound) {
                uploadCompleteFound = await checkPageForSuccessText();
            }
            
            // 如果仍未检测到，短暂等待后重试
            if (!uploadCompleteFound) {
                await wait(5000);
            }
        }
        
        // 最后检查一次页面文本，确保没有错过成功提示
        if (!uploadCompleteFound) {
            uploadCompleteFound = await checkPageForSuccessText();
        }
        
        // 如果还是没有找到上传完成状态，记录并继续
        if (!uploadCompleteFound) {
            log('未检测到明确的上传完成状态，但可能已经完成，继续后续步骤');
        }
        
        // 尝试上传封面（如果有对应的封面文件）
        try {
            // 查找当前视频对应的封面文件
            const currentVideo = path.basename(videoPath);
            const currentVideoBaseName = path.basename(videoPath, path.extname(videoPath));
            let coverPath = null;
            
            // 从全局配对信息中查找封面
            if (global.VIDEO_COVER_PAIRS) {
                const pair = global.VIDEO_COVER_PAIRS.find(p => 
                    path.basename(p.video) === currentVideo || 
                    path.basename(p.video, path.extname(p.video)) === currentVideoBaseName
                );
                coverPath = pair ? pair.cover : null;
            }
            
            if (coverPath) {
                log(`准备上传封面: ${coverPath}`);
                
                // 尝试查找封面上传按钮
                const coverUploadSelectors = [
                    '.cover-upload-btn',
                    '#cover-upload-btn',
                    'button:contains("封面")',
                    'button:contains("上传封面")',
                    'input[type="file"][accept="image/*"]',
                    '.js_upload_img_file',
                    '[name="uploadFile"]'
                ];
                
                let coverUploadFound = false;
                for (const selector of coverUploadSelectors) {
                    try {
                        log(`尝试查找封面上传按钮: ${selector}`);
                        const elements = await page.$$(selector);
                        
                        if (elements.length > 0) {
                            coverUploadFound = true;
                            log(`找到封面上传元素: ${selector}`);
                            
                            // 检查是否是直接的文件输入
                            if (selector.includes('input[type="file"]') || 
                                await page.evaluate(el => el.tagName === 'INPUT' && el.type === 'file', elements[0])) {
                                // 直接使用uploadFile方法上传文件
                                await elements[0].uploadFile(coverPath);
                                log(`成功上传封面文件`);
                            } else {
                                // 先点击按钮，然后尝试找到弹出的文件输入框
                                await elements[0].click();
                                log(`点击了封面上传按钮，等待文件选择框`);
                                await wait(2000);
                                
                                // 尝试查找文件输入框
                                const fileInputs = await page.$$('input[type="file"]');
                                for (const input of fileInputs) {
                                    try {
                                        await input.uploadFile(coverPath);
                                        log(`成功使用文件输入框上传封面`);
                                        break;
                                    } catch (e) {
                                        // 尝试下一个输入框
                                    }
                                }
                            }
                            
                            await wait(3000); // 等待封面上传完成
                            break;
                        }
                    } catch (e) {
                        log(`查找封面上传按钮 ${selector} 失败: ${e.message}`);
                    }
                }
                
                if (!coverUploadFound) {
                    log('未找到封面上传按钮，尝试使用JavaScript注入方式');
                    
                    // 使用JavaScript注入方式上传封面
                    await page.evaluate(async (coverFileName) => {
                        // 查找所有可能的文件输入元素
                        const fileInputs = document.querySelectorAll('input[type="file"]');
                        let foundImageInput = false;
                        
                        for (const input of fileInputs) {
                            // 检查是否是图片上传输入
                            if (input.accept.includes('image') || 
                                input.name.includes('image') || 
                                input.name.includes('cover') ||
                                input.id.includes('image') || 
                                input.id.includes('cover')) {
                                foundImageInput = true;
                                console.log('找到可能的图片上传输入框:', input);
                                
                                // 触发一个change事件（在真实环境中，这里需要模拟文件选择）
                                // 在Puppeteer中，uploadFile方法会处理这个
                                const event = new Event('change', { bubbles: true });
                                input.dispatchEvent(event);
                                break;
                            }
                        }
                        
                        if (!foundImageInput) {
                            console.log('未找到明确的图片上传输入框');
                        }
                    }, path.basename(coverPath));
                }
            } else {
                log('无匹配的封面文件，跳过封面上传');
            }
        } catch (e) {
            log(`上传封面时出错: ${e.message}`);
            // 封面上传失败不影响视频上传
        }
        
        await wait(1000);
        try {
            const titleSelectors = ['input[name="title"]', '#title', '.title-input'];
            let titleInputFound = false;
            
            for (const selector of titleSelectors) {
                try {
                    log(`尝试选择器填写标题: ${selector}`);
                    await page.waitForSelector(selector, { timeout: 2000 });
                    await page.type(selector, videoTitle);
                    titleInputFound = true;
                    log(`成功填写视频标题: ${videoTitle}`);
                    break;
                } catch (e) {
                    log(`选择器 ${selector} 填写标题失败: ${e.message}`);
                }
            }
            
            if (!titleInputFound) {
                log('未找到标题输入框，跳过填写标题步骤');
            }
        } catch (e) {
            log(`填写标题时出错: ${e.message}`);
        }
        
        await wait(1000);
        
        // 尝试点击确定按钮，使用多种可能的选择器
        try {
            const submitSelectors = ['button#submit', '.submit-btn', '[type="submit"]', 'button:contains("确定")', 'button:contains("保存")'];
            let submitButtonFound = false;
            
            for (const selector of submitSelectors) {
                try {
                    log(`尝试选择器点击提交按钮: ${selector}`);
                    await page.waitForSelector(selector, { timeout: 2000 });
                    await page.click(selector);
                    submitButtonFound = true;
                    log('成功点击提交按钮');
                    break;
                } catch (e) {
                    log(`选择器 ${selector} 点击提交按钮失败: ${e.message}`);
                }
            }
            
            if (!submitButtonFound) {
                log('未找到提交按钮，跳过提交步骤');
            }
        } catch (e) {
            log(`点击提交按钮时出错: ${e.message}`);
        }
        
        await wait(3000);
        
        // 检查是否上传成功，使用多种选择器
        log('检查上传是否成功...');
        const successSelectors = [
            '.success-msg',
            '.success提示',
            '.alert-success',
            '.message-success',
            ':contains("上传成功")',
            ':contains("添加成功")'
        ];
        
        let uploadSuccess = false;
        for (const selector of successSelectors) {
            try {
                log(`尝试检测成功提示: ${selector}`);
                const elements = await page.$$(selector);
                if (elements.length > 0) {
                    uploadSuccess = true;
                    log(`检测到成功提示: ${selector}`);
                    break;
                }
            } catch (e) {
                log(`选择器 ${selector} 检测失败: ${e.message}`);
            }
        }
        
        // 如果没有明确的成功提示，尝试检查页面内容中是否包含成功相关文本
        if (!uploadSuccess) {
            log('尝试通过页面文本检测上传成功状态...');
            const pageContent = await page.evaluate(() => document.body.textContent);
            const successKeywords = ['上传成功', '添加成功', '保存成功', '处理完成'];
            
            for (const keyword of successKeywords) {
                if (pageContent.includes(keyword)) {
                    uploadSuccess = true;
                    log(`在页面内容中检测到成功关键词: ${keyword}`);
                    break;
                }
            }
        }
        
        if (uploadSuccess) {
            log(`视频 ${fileName} 上传成功！`);
            return true;
        } else {
            // 即使没有检测到成功提示，也记录页面的一些信息用于调试
            const currentUrl = await page.url();
            const pageTitle = await page.title();
            log(`当前URL: ${currentUrl}`);
            log(`当前页面标题: ${pageTitle}`);
            
            // 检查是否有错误提示，特别是创建文件失败相关的
            try {
                const errorMessages = await page.$$eval('.error-msg, .alert-error, .message-error, .tips-error', elements => 
                    elements.map(el => el.textContent.trim())
                );
                
                if (errorMessages.length > 0) {
                    log('页面上的错误信息:');
                    errorMessages.forEach((msg, index) => log(`  ${index + 1}. ${msg}`));
                    
                    // 检查是否包含创建文件失败错误
                    for (const msg of errorMessages) {
                        if (msg.includes('创建文件失败') || msg.includes('200002')) {
                            throw new Error(`创建文件失败 (200002): ${msg}`);
                        }
                    }
                }
            } catch (e) {
                log(`获取错误信息时出错: ${e.message}`);
            }
            
            throw new Error('上传未返回明确的成功信息，请检查页面状态');
        }
    } catch (error) {
        log(`上传视频失败: ${error.message}`);
        
        // 特别处理创建文件失败错误
        if (error.message.includes('创建文件失败') || error.message.includes('200002')) {
            log(`检测到创建文件失败错误，这通常与文件路径或权限有关`);
            log(`建议检查以下几点:`);
            log(`1. 文件路径是否正确: ${cleanVideoPath}`);
            log(`2. 文件是否存在: ${fs.existsSync(cleanVideoPath) ? '是' : '否'}`);
            log(`3. 文件权限是否正确`);
            log(`4. 尝试使用更短的文件名`);
        }
        
        // 重试逻辑
        if (retries < config.maxRetries) {
            log(`准备第 ${retries + 1} 次重试...`);
            // 对于创建文件失败的错误，增加重试间隔
            if (error.message.includes('创建文件失败') || error.message.includes('200002')) {
                log('为创建文件失败错误增加重试等待时间...');
                await wait(5000);
            }
            return uploadVideo(page, videoPath, retries + 1);
        }
        
        log(`视频上传最终失败，已达到最大重试次数`);
        return false;
    }
};

// 批量上传视频
const batchUploadVideos = async () => {
    // 启动浏览器，使用系统已安装的Chrome
    const browser = await puppeteer.launch({
        headless: config.headless,
        defaultViewport: null,
        args: ['--start-maximized'],
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    });
    
    const page = await browser.newPage();
    
    let videoFiles = [];
    
    try {
        // 导航到微信公众号登录页
        await page.goto('https://mp.weixin.qq.com/');
        await wait(2000);
        
        // 等待用户登录
        await waitForLogin(page);
        
        // 导航到素材管理页面，使用获取的token
        const materialPageUrl = `https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/videomsg_edit&action=video_edit&type=15&isNew=1&token=${WECHAT_MP_TOKEN}`;
        await page.goto(materialPageUrl);
        log('素材管理页面加载中...');
        await wait(5000);
        
        // 在素材管理页面中插入悬浮按钮
        await page.evaluate(() => {
            // 创建悬浮按钮和隐藏的文件输入框
            const floatButton = document.createElement('div');
            floatButton.id = 'video-selector-container';
            floatButton.style.position = 'fixed';
            floatButton.style.top = '50px';
            floatButton.style.right = '50px';
            floatButton.style.zIndex = '9999';
            floatButton.style.textAlign = 'center';
            
            const buttonHtml = `
                <button id="select-directory-btn" style="
                    padding: 12px 24px;
                    font-size: 16px;
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: background-color 0.3s;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                ">
                    选择视频目录
                </button>
                <input type="file" id="directory-selector" webkitdirectory directory multiple style="display: none;">
                <div id="debug-info" style="
                    margin-top: 10px;
                    padding: 10px;
                    background-color: white;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    min-height: 30px;
                    font-size: 12px;
                    text-align: left;
                    max-width: 250px;
                ">
                    调试信息：等待选择文件...
                </div>
            `;
            
            floatButton.innerHTML = buttonHtml;
            document.body.appendChild(floatButton);
            
            // 为按钮添加点击事件，触发文件选择器
            const button = document.getElementById('select-directory-btn');
            const fileInput = document.getElementById('directory-selector');
            const debugInfo = document.getElementById('debug-info');
            
            if (button && fileInput) {
                button.addEventListener('click', () => {
                    console.log('悬浮按钮被点击，触发文件选择器');
                    if (debugInfo) {
                        debugInfo.textContent = '按钮被点击，触发文件选择器...';
                    }
                    fileInput.click();
                });
                
                // 添加文件选择变化事件
                fileInput.addEventListener('change', () => {
                    console.log('文件选择发生变化');
                    if (debugInfo) {
                        if (fileInput.files && fileInput.files.length > 0) {
                            debugInfo.textContent = `已选择 ${fileInput.files.length} 个文件`;
                            // 显示第一个文件的信息
                            const firstFile = fileInput.files[0];
                            debugInfo.textContent += `\n第一个文件: ${firstFile.name}`;
                            debugInfo.textContent += `\n文件类型: ${firstFile.type || '未知'}`;
                            debugInfo.textContent += `\n文件大小: ${firstFile.size} 字节`;
                            
                            // 检查是否有path属性
                            if (firstFile.path) {
                                debugInfo.textContent += `\n文件路径: ${firstFile.path}`;
                            } else {
                                debugInfo.textContent += '\n文件没有path属性';
                            }
                            
                            // 检查webkitRelativePath
                            if (firstFile.webkitRelativePath) {
                                debugInfo.textContent += `\nWebkit路径: ${firstFile.webkitRelativePath}`;
                            }
                        } else {
                            debugInfo.textContent = '未选择任何文件';
                        }
                    }
                });
            }
        });
        
        log('素材管理页面已加载完成，悬浮按钮已插入');
        log('请点击页面右上角的"选择视频目录"悬浮按钮...');
        
        // 创建一个Promise来等待用户选择文件
        const selectedFilesPromise = new Promise(async (resolve, reject) => {
            // 设置超时
            const timeoutId = setTimeout(() => {
                log('文件选择超时，请在2分钟内完成文件选择');
                reject(new Error('文件选择超时'));
            }, 120000); // 2分钟超时
            
            // 添加脚本到页面，监听文件选择变化
            await page.exposeFunction('onFilesSelected', (files) => {
                clearTimeout(timeoutId);
                resolve(files);
            });
            
            await page.exposeFunction('onFileSelectionError', (error) => {
                clearTimeout(timeoutId);
                reject(new Error(error));
            });
            
            // 在页面中添加文件选择处理逻辑
            await page.evaluate(() => {
                const fileInput = document.getElementById('directory-selector');
                const debugInfo = document.getElementById('debug-info');
                
                if (fileInput) {
                    fileInput.addEventListener('change', async () => {
                        console.log('检测到文件选择变化，尝试获取文件信息');
                        if (debugInfo) {
                            debugInfo.textContent += '\n检测到文件选择变化，正在处理...';
                        }
                        
                        try {
                            if (fileInput.files && fileInput.files.length > 0) {
                                const files = [];
                                
                                for (let i = 0; i < fileInput.files.length; i++) {
                                    const file = fileInput.files[i];
                                    
                                    // 收集文件信息
                                    const fileInfo = {
                                        name: file.name,
                                        type: file.type || 'unknown',
                                        size: file.size,
                                        hasPath: !!file.path,
                                        hasFullPath: !!file.fullPath,
                                        hasWebkitRelativePath: !!file.webkitRelativePath,
                                        webkitRelativePath: file.webkitRelativePath || '',
                                        inputValue: document.getElementById('directory-selector').value
                                    };
                                    
                                    // 尝试获取路径
                                    if (file.path) {
                                        fileInfo.path = file.path;
                                    } else if (file.fullPath) {
                                        fileInfo.path = file.fullPath;
                                    }
                                    
                                    files.push(fileInfo);
                                }
                                
                                console.log('收集到文件信息:', files);
                                if (debugInfo) {
                                    debugInfo.textContent += `\n成功收集到 ${files.length} 个文件的信息`;
                                }
                                
                                // 将文件信息传回Node.js环境
                                window.onFilesSelected(files);
                            } else {
                                const errorMsg = '未选择任何文件';
                                console.log(errorMsg);
                                if (debugInfo) {
                                    debugInfo.textContent += '\n' + errorMsg;
                                }
                                window.onFileSelectionError(errorMsg);
                            }
                        } catch (error) {
                            console.error('处理文件选择时出错:', error);
                            if (debugInfo) {
                                debugInfo.textContent += '\n处理文件选择时出错: ' + error.message;
                            }
                            window.onFileSelectionError(error.message);
                        }
                    });
                } else {
                    const errorMsg = '无法找到文件输入元素';
                    console.error(errorMsg);
                    if (debugInfo) {
                        debugInfo.textContent = errorMsg;
                    }
                    window.onFileSelectionError(errorMsg);
                }
            });
            
            log('等待用户选择视频文件...');
        });
        
        // 等待用户选择文件
        let fileInfos;
        try {
            fileInfos = await selectedFilesPromise;
            log(`成功获取到 ${fileInfos.length} 个文件的信息`);
        } catch (error) {
            log(`选择目录时发生错误: ${error.message}`);
            throw error;
        }
        
        // 基于fileInfos构建视频文件路径列表
        videoFiles = fileInfos.map(fileInfo => {
            let filePath = '';
            
            // 尝试多种方式获取文件路径
            if (fileInfo.path) {
                filePath = fileInfo.path;
            } else if (fileInfo.fullPath) {
                filePath = fileInfo.fullPath;
            } else {
                // 尝试从inputValue和文件名构建路径
                const directoryPath = fileInfo.inputValue.replace(/fakepath\\/g, '').replace(/fakepath\//g, '');
                filePath = directoryPath + '/' + fileInfo.name;
            }
            
            // 记录调试信息
            log(`获取文件路径: ${filePath} (hasPath: ${fileInfo.hasPath}, hasFullPath: ${fileInfo.hasFullPath}, hasWebkitRelativePath: ${fileInfo.hasWebkitRelativePath})`);
            
            return filePath;
        }).filter(path => path); // 过滤掉空路径
        
        // 过滤保留视频和PNG文件
        const allFiles = videoFiles.filter(file => {
            if (!file) return false;
            
            // 清理文件路径，移除可能的fakepath前缀
            const cleanPath = file.replace(/fakepath\\/g, '').replace(/fakepath\//g, '');
            const ext = path.extname(cleanPath).toLowerCase();
            const isVideoOrPng = ['.mp4', '.mov', '.avi', '.flv', '.wmv', '.mkv', '.png'].includes(ext);
            
            if (isVideoOrPng) {
                log(`识别为支持的文件: ${cleanPath}`);
            }
            
            return isVideoOrPng;
        });
        
        // 构建视频与封面匹配的数据结构
        const videoCoverPairs = [];
        const videoFilesMap = new Map();
        const pngFilesMap = new Map();
        
        // 分别收集视频和PNG文件
        allFiles.forEach(file => {
            const cleanPath = file.replace(/fakepath\\/g, '').replace(/fakepath\//g, '');
            const ext = path.extname(cleanPath).toLowerCase();
            const baseName = path.basename(cleanPath, ext);
            
            if ([ '.mp4', '.mov', '.avi', '.flv', '.wmv', '.mkv' ].includes(ext)) {
                videoFilesMap.set(baseName, cleanPath);
            } else if (ext === '.png') {
                pngFilesMap.set(baseName, cleanPath);
            }
        });
        
        // 匹配视频和封面
        videoFilesMap.forEach((videoPath, baseName) => {
            const coverPath = pngFilesMap.get(baseName);
            videoCoverPairs.push({
                video: videoPath,
                cover: coverPath || null
            });
            
            if (coverPath) {
                log(`匹配视频和封面: ${videoPath} -> ${coverPath}`);
            } else {
                log(`视频无匹配封面: ${videoPath}`);
            }
        });
        
        // 更新视频文件列表为配对后的视频路径
        videoFiles = videoCoverPairs.map(pair => pair.video);
        
        // 存储配对信息供上传函数使用
        global.VIDEO_COVER_PAIRS = videoCoverPairs;
        
        if (videoFiles.length === 0) {
            log('未找到有效的视频文件');
            await browser.close();
            return;
        }
        
        log(`发现 ${videoFiles.length} 个视频文件，准备开始上传...`);
    } catch (error) {
        log(`选择目录时发生错误: ${error.message}`);
        await browser.close();
        return;
    }
    
    try {
        // 确保页面仍然在素材管理页
        if (!page.url().includes('videomsg_edit')) {
            const materialPageUrl = `https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/videomsg_edit&action=video_edit&type=15&isNew=1&token=${WECHAT_MP_TOKEN}`;
            await page.goto(materialPageUrl);
            await wait(3000);
        }
        
        // 逐个上传视频
        let successCount = 0;
        let failCount = 0;
        
        for (const [index, videoPath] of videoFiles.entries()) {
            log(`正在处理第 ${index + 1}/${videoFiles.length} 个视频`);
            
            const success = await uploadVideo(page, videoPath);
            
            if (success) {
                successCount++;
            } else {
                failCount++;
                // 记录上传失败的视频
                fs.appendFileSync('upload-failures.txt', `${new Date().toISOString()} - ${videoPath}\n`);
            }
            
            // 最后一个视频不需要等待
            if (index < videoFiles.length - 1) {
                log(`等待 ${config.delayBetweenUploads / 1000} 秒后上传下一个视频...`);
                await wait(config.delayBetweenUploads);
            }
        }
        
        log(`批量上传完成！成功: ${successCount} 个，失败: ${failCount} 个`);
        log(`失败的视频记录已保存到 upload-failures.txt`);
        
    } catch (error) {
        log(`批量上传过程中发生错误: ${error.message}`);
    } finally {
        // 询问是否关闭浏览器
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        rl.question('是否关闭浏览器? (y/n) ', (answer) => {
            if (answer.toLowerCase() === 'y') {
                browser.close();
            }
            rl.close();
        });
    }
};

// 开始执行
batchUploadVideos();
    
// 从URL中提取参数值的工具函数
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

// 批量处理文章删除的主函数
async function batchDeleteArticles() {
    try {
        // 获取当前页面的URL作为Referer
        const currentUrl = window.location.href;
        console.log(`使用当前页面URL作为Referer: ${currentUrl}`);

        // 从当前URL中提取token
        const token = getParamFromUrl(currentUrl, 'token');
        if (!token) {
            console.error("无法从当前页面URL中提取token，请确保在包含token参数的页面上运行此代码");
            return;
        }
        console.log(`从当前页面提取到token: ${token}`);

        // 检查wx.cgiData.item是否存在
        if (!wx || !wx.cgiData || !wx.cgiData.item || !Array.isArray(wx.cgiData.item)) {
            console.error("未找到有效的wx.cgiData.item数据");
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
            return;
        }

        console.log(`共发现 ${articles.length} 篇文章待处理：`);
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
        switch (action) {
            case "0":
                console.log("已取消所有操作");
                return;
            case "1":
                console.log("开始逐个确认删除...");
                for (const article of articles) {
                    const confirmDelete = confirm(`是否删除这篇文章？\nID: ${article.appId}\n标题: ${article.title}`);
                    if (confirmDelete) {
                        await deleteSingleArticle(article.appId, token, currentUrl);
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
                        await deleteSingleArticle(article.appId, token, currentUrl);
                        // 等待一段时间再处理下一个，避免请求过于频繁
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    console.log(`全部 ${articles.length} 篇文章删除操作已执行完成`);
                } else {
                    console.log("已取消全部删除操作");
                }
                break;
            default:
                console.log("无效输入，已取消操作");
                return;
        }
    } catch (error) {
        console.error("批量处理过程中发生错误：");
        console.error(error);
    }
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

// 执行批量处理函数
batchDeleteArticles();
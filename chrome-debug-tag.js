// 在”新建标签“按钮（js_tag_add_btn）后面增加一个”自动批量标签“的按钮（js_auto_tag_add_btn）
if (!document.getElementById('js_auto_tag_add_btn')) {
    const autoTagAddBtn = document.createElement('button');
    autoTagAddBtn.id = 'js_auto_tag_add_btn';
    autoTagAddBtn.textContent = '自动批量标签';
    autoTagAddBtn.style.marginLeft = '10px';
    autoTagAddBtn.style.padding = '5px 10px';
    autoTagAddBtn.style.backgroundColor = '#007bff';
    autoTagAddBtn.style.color = 'white';
    autoTagAddBtn.style.border = 'none';
    autoTagAddBtn.style.borderRadius = '4px';
    autoTagAddBtn.style.cursor = 'pointer';

    // 插入到”新建标签“按钮后面
    document.getElementById('js_tag_add_btn').parentNode.insertBefore(autoTagAddBtn, document.getElementById('js_tag_add_btn').nextSibling);

    // 为自动批量标签按钮添加点击事件
    autoTagAddBtn.addEventListener('click', initAutoTagAdd);
}

// 初始化自动批量标签功能
async function initAutoTagAdd() {
    appendDebugInfo('开始自动批量标签...');

    // 创建配置弹框，包含：
    // 1. 标题栏：标题”自动标签配置“、关闭按钮（&times;）
    // 2. 标签列表：展示所有标签（横向展示，每个标签前面有一个复选框，用户可以选择一个或多个标签）
    // 3. 用户选择范围：起始页（默认为1）、结束页（默认为最大页，根据wx.cgiData.total_user_num和每页20条计算），横向展示，中间用”-“连接
    // 4. 间隔时间设置：默认500ms，用户可以自定义
    // 5. 开始按钮（开始）
    // 6. 状态显示：显示当前操作状态（例如：“等待用户选择”、“正在处理...”、“完成”）
    if (!document.getElementById('js_auto_tag_config_dialog')) {
        const configDialog = document.createElement('div');
        configDialog.id = 'js_auto_tag_config_dialog';
        configDialog.style.position = 'fixed';
        configDialog.style.top = '50%';
        configDialog.style.left = '50%';
        configDialog.style.transform = 'translate(-50%, -50%)';
        configDialog.style.backgroundColor = 'white';
        configDialog.style.padding = '20px';
        configDialog.style.borderRadius = '8px';
        configDialog.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.3)';
        configDialog.style.zIndex = '9999';
        configDialog.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0;">自动标签配置</h3>
            <span style="cursor: pointer;" id="js_close_config_dialog">&times;</span>
        </div>
        <div style="margin-top: 20px;">
            <label>选择标签：</label>
            <div id="js_tag_list"></div>
        </div>
        <div style="margin-top: 20px;">
            <label>页面范围：</label>
            <input type="number" id="js_start_page" value="1" style="width: 50px;">
            <label>-</label>
            <input type="number" id="js_end_page" value="-1" style="width: 50px;">
        </div>
        <div style="margin-top: 20px;">
            <label>间隔时间：</label>
            <input type="number" id="js_interval_time" value="500" style="width: 50px;">
            <label>毫秒</label>
        </div>
        <div style="margin-top: 20px;">
            <button id="js_confirm_add_tags" class="btn btn_primary">开始</button>
        </div>
        <div style="margin-top: 20px;">
            <span id="js_status_message" style="font-size: 12px; color: #666;">请选择要添加的标签，以及要处理的页面范围。</span>
        </div>
        `;
        document.body.appendChild(configDialog);

        // 设置最大页数
        const maxPages = Math.ceil(wx.cgiData.total_user_num / 20);
        document.getElementById('js_end_page').value = maxPages;

        // 将wx.cgiData.group_list中的标签展示到弹框中
        const tagListContainer = document.getElementById('js_tag_list');
        if (wx.cgiData && wx.cgiData.group_list && wx.cgiData.group_list.length > 0) {
            wx.cgiData.group_list.forEach(group => {
                if (group.id > '0') {
                    const tagItem = document.createElement('div');
                    tagItem.style.display = 'inline-block';
                    tagItem.style.marginRight = '10px';
                    tagItem.innerHTML = `<input type="checkbox" value="${group.id}"> ${group.name}`;
                    tagListContainer.appendChild(tagItem);
                }
            });
        } else {
            appendDebugInfo('获取到的标签清单为空');
        }


        // 关闭按钮点击事件
        document.getElementById('js_close_config_dialog').addEventListener('click', () => {
            // 清空状态信息
            document.getElementById('js_status_message').textContent = '请选择要添加的标签，以及要处理的页面范围。';
            // 隐藏弹框
            configDialog.style.display = 'none';
        });

        // 开始按钮点击事件
        document.getElementById('js_confirm_add_tags').addEventListener('click', async () => {
            // 检查用户是否选择了标签
            const selectedTags = document.querySelectorAll('#js_tag_list input:checked');
            if (selectedTags.length === 0) {
                document.getElementById('js_status_message').textContent = '请选择要添加的标签。';
                return;
            } else {
                // 检查用户是否选择了起始页和结束页
                const startPage = parseInt(document.getElementById('js_start_page').value);
                const endPage = parseInt(document.getElementById('js_end_page').value);
                if (isNaN(startPage) || isNaN(endPage) || startPage < 1 || endPage < 1 || startPage > endPage) {
                    document.getElementById('js_status_message').textContent = '请输入有效的起始页和结束页。';
                    return;
                } else {
                    // 开始添加标签
                    updateStatus('开始处理...');
                    // 从配置中获取间隔时间
                    const intervalTime = parseInt(document.getElementById('js_interval_time').value);
                    if (isNaN(intervalTime)) {
                        updateStatus('请输入有效的间隔时间（0ms表示不间隔）。');
                        return;
                    }

                    // 获取当前所在页数
                    let currentPage = 1;
                    // 用wx.cgiData.user_list的用户列表，初始化当前所在页的用户列表，id映射为user_openid，create_time映射为user_create_time
                    let usersOnCurrentPage = wx.cgiData.user_list.map(user => ({
                        user_openid: user.id,
                        user_create_time: user.create_time,
                        user_name: user.nick_name,
                    }));
                    if (usersOnCurrentPage.length === 0) {
                        appendDebugInfo('当前所在页没有用户');
                        return;
                    }

                    // 如果当前页为开始页，则从当前页开始打标签，否则先跳转到开始页并开始打标签
                    let params = {
                        action: 'get_user_list',
                        group_id: '-2',
                        begin_openid: usersOnCurrentPage[usersOnCurrentPage.length - 1].user_openid, // 最后一个用户的openid
                        begin_create_time: usersOnCurrentPage[usersOnCurrentPage.length - 1].user_create_time, // 最后一个用户的创建时间
                        token: window.location.href.match(/token=(\d+)/)[1],
                        offset: 0,
                        limit: 20,
                        backfoward: 1,
                        lang: 'zh_CN',
                        f: 'json',
                        ajax: 1,
                    };
                    // 如果超过25页，则以25页为一个周期，分多轮跳转
                    while (currentPage < startPage - 25) {
                        // 跳转到当前页
                        updateStatus('跳转到页面：' + currentPage);
                        // 根据当前所在页和当前页的差值，计算offset，每页20个用户
                        params.offset = 24 * 20;
                        // 发送请求获取当前页的用户列表
                        try {
                            const response = await fetch('https://mp.weixin.qq.com/cgi-bin/user_tag?action=get_user_list&' + new URLSearchParams(params).toString(), {
                                method: 'GET',
                            });
                            // 检查响应状态
                            if (!response.ok) {
                                updateStatus('获取用户列表失败：' + response.statusText);
                                continue;
                            }
                            try {
                                const data = await response.json();
                                // appendDebugInfo('当前页用户列表：' + JSON.stringify(data));
                                // 用data.user_list的用户列表，初始化当前所在页的用户列表
                                usersOnCurrentPage = data.user_list.user_info_list;
                                params.begin_openid = usersOnCurrentPage[usersOnCurrentPage.length - 1].user_openid; // 最后一个用户的openid
                                params.begin_create_time = usersOnCurrentPage[usersOnCurrentPage.length - 1].user_create_time; // 最后一个用户的创建时间
                                currentPage += 25;
                            } catch (error) {
                                updateStatus('解析用户列表失败：' + error.message);
                                continue;
                            }
                        } catch (error) {
                            updateStatus('获取用户列表失败：' + error.message);
                            continue;
                        }


                    }
                    if (currentPage !== startPage) {
                        // 跳转到开始页
                        appendDebugInfo('跳转到开始页：' + startPage);
                        // 根据当前所在页和开始页的差值，计算offset，每页20个用户
                        params.offset = (startPage - currentPage - 1) * 20;
                        if (startPage < currentPage) {
                            params.backfoward = 0;
                            params.offset = (currentPage - startPage - 1) * 20;
                        }
                        // 发送请求获取开始页的用户列表
                        const response = await fetch('https://mp.weixin.qq.com/cgi-bin/user_tag?action=get_user_list&' + new URLSearchParams(params).toString(), {
                            method: 'GET',
                        });
                        const data = await response.json();
                        // appendDebugInfo('开始页用户列表：' + JSON.stringify(data));
                        // 用data.user_list的用户列表，初始化当前所在页的用户列表
                        usersOnCurrentPage = data.user_list.user_info_list;
                        currentPage = startPage;
                    }
                    if (usersOnCurrentPage.length === 0) {
                        appendDebugInfo('当前所在页没有用户');
                        return;
                    }

                    params.backfoward = 1;
                    // 拼接标签ID
                    const selectedTagIds = Array.from(selectedTags).map(tag => tag.value).join('|');
                    const selectedTagName = Array.from(selectedTags).map(tag => tag.nextSibling.textContent.trim()).join(',');
                    appendDebugInfo('用户选择的标签：' + selectedTagName);
                    // 遍历页数范围内的所有用户，为每个用户添加选中的标签
                    for (let page = startPage; page <= endPage; page++) {
                        // 根据页码获取目标页面用户列表请求参数
                        if (page !== currentPage) {
                            // 按照每页20个用户，计算目标页到当前页的offset
                            params.offset = (page - currentPage - 1) * 20;
                            params.begin_openid = usersOnCurrentPage[usersOnCurrentPage.length - 1].user_openid; // 最后一个用户的openid
                            params.begin_create_time = usersOnCurrentPage[usersOnCurrentPage.length - 1].user_create_time; // 最后一个用户的创建时间
                            // 发送请求获取开始页的用户列表
                            const response = await fetch('https://mp.weixin.qq.com/cgi-bin/user_tag?action=get_user_list&' + new URLSearchParams(params).toString(), {
                                method: 'GET',
                            });
                            const data = await response.json();
                            appendDebugInfo('开始页用户列表：' + JSON.stringify(data));
                            // 用data.user_list的用户列表，初始化当前所在页的用户列表
                            usersOnCurrentPage = data.user_list.user_info_list;
                            currentPage = page;
                        }
                        if (usersOnCurrentPage.length === 0) {
                            appendDebugInfo('当前所在页没有用户');
                            continue;
                        }
                        // 用'|'拼接用户列表，调用批量标签接口打标签
                        const userTagParams = {
                            token: window.location.href.match(/token=(\d+)/)[1],
                            lang: 'zh_CN',
                            f: 'json',
                            ajax: 1,
                            groupid_list: selectedTagIds,
                            user_openid_list: usersOnCurrentPage.map(user => user.user_openid).join('|'),
                            cexpandcol: 3
                        };
                        console.log('批量标签接口参数：', userTagParams);
                        updateStatus('正在处理第' + page + '页用户，标签：' + selectedTagName + '，用户：' + usersOnCurrentPage.map(user => user.user_name).join(','));
                        // 发送请求批量打标签
                        try {
                            const tagResponse = await fetch('https://mp.weixin.qq.com/cgi-bin/user_tag?action=batch_set_tag', {
                                method: 'POST',
                                // 批量标签接口要求body是form-urlencoded格式
                                body: new URLSearchParams(userTagParams),
                            });
                            // 检查响应状态
                            if (!tagResponse.ok) {
                                updateStatus('批量打标签失败：' + tagResponse.statusText);
                                continue;
                            }
                            try {
                                const tagData = await tagResponse.json();
                                appendDebugInfo('处理结果：' + (tagData.base_resp.ret === 0 ? '成功' : '失败'));
                            } catch (error) {
                                updateStatus('解析批量打标签结果失败：' + error.message + '，重试');
                                continue;
                            }
                        } catch (error) {
                            updateStatus('批量打标签失败：' + error.message);
                            continue;
                        }
                        // 如果有间隔时间，等待指定时间后继续处理下一页
                        if (intervalTime > 0) {
                            await new Promise(resolve => setTimeout(resolve, intervalTime));
                        }
                    }
                    updateStatus('处理完成！');
                }
            }
        })
    } else {
        if (!document.getElementById('js_auto_tag_config_dialog').checkVisibility()) {
            // 显示弹框
            document.getElementById('js_auto_tag_config_dialog').style.display = 'block';
        }
    }
}

/**
 * 获取标签清单
 */
async function getTagList() {
    appendDebugInfo('开始获取标签清单...');
    // 从当前页面地址中获取token值
    const token = window.location.href.match(/token=(\d+)/)[1];
    appendDebugInfo('从当前页面地址中获取到的token值：' + token);

    // 发送请求获取标签清单
    const response = await fetch(`https://mp.weixin.qq.com/cgi-bin/user_tag?action=get_user_list&groupid=-2&begin_openid=-1&begin_create_time=-1&limit=20&offset=0&backfoward=1&token=${token}&lang=zh_CN&f=json&ajax=1`);
    const data = await response.json();
    appendDebugInfo('获取到的标签清单数据：' + JSON.stringify(data));

    // 解析标签清单
    const tagList = data.group_info.group_info_list || [];
    return tagList.map(tag => ({
        name: tag.group_name,
        id: tag.group_id
    }));
}

/**
 * 追加调试信息
 * @param {string} message - 要追加的信息
 */
function appendDebugInfo(message) {
    const debugElement = document.getElementById('js_status_message');
    if (debugElement) {
        debugElement.textContent += '\n' + message;
        console.log('[调试信息]', message);
    } else {
        console.log('[调试信息]', message);
    }
}

/**
 * 更新状态信息
 * @param {string} message - 要更新的状态信息
 */
function updateStatus(message) {
    const statusDiv = document.getElementById('js_status_message');
    if (statusDiv) {
        statusDiv.textContent = message;
    }
    console.log('[状态更新]', message);
}

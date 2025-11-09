// 草稿箱记录批量管理脚本（干净版）
// 从 wx.cgiData.item 读取未删除草稿箱记录，支持批量选择与删除
(function () {
  if (window.CardBatchManagerInitialized) {
    console.log('草稿箱记录批量管理脚本已初始化，跳过');
    return;
  }
  window.CardBatchManagerInitialized = true;

  function appendLog(message) {
    console.log('[草稿箱记录批量管理]', message);
    const el = document.getElementById('card-debug');
    if (el) el.textContent += (el.textContent ? '\n' : '') + message;
  }

  // 从 wx.cgiData.item 获取所有未删除草稿箱记录
  function collectPublishedArticles() {
    try {
      const root = window.wx && wx.cgiData;
      const list = root && Array.isArray(root.item) ? root.item : null;
      if (!list) throw new Error('wx.cgiData.item 不存在');

      appendLog(`从wx.cgiData.item收集未删除草稿箱记录 ${list.length} 条`);
      return list;
    } catch (e) {
      appendLog(`收集失败：${e.message}`);
      return [];
    }
  }

  async function performBatchDelete() {
    const items = collectPublishedArticles();
    if (!items.length) { 
      alert('未找到未删除的草稿箱记录'); 
      return; 
    } else {
      appendLog(`确认删除 ${items.length} 条草稿箱记录`);
      const confirm = window.confirm(`确认删除 ${items.length} 条草稿箱记录吗？`);
      if (!confirm) {
        appendLog('用户取消了删除操作');
        return;
      }
    }
    const currentUrl = window.location.href;
    const token = new URL(currentUrl).searchParams.get('token');
    if (!token) {
      alert('未找到token，请先登录微信公众平台');
      return;
    }
    const batchDeleteBtn = document.getElementById('article-batch-delete-button');
    if (!batchDeleteBtn) {
      alert('未找到批量删除按钮');
      return;
    } else {
      batchDeleteBtn.textContent = `批量删除(0/${items.length})`;
      batchDeleteBtn.disabled = true;
    }
    // 调用单篇文章删除函数逐条删除
    let successCount = 0;
    for (const item of items) {
      try {
        await deleteSingleCard(item.app_id, token, currentUrl);
        appendLog(`删除成功：${item.title} -> app_id: ${item.app_id}`);
        successCount++;
        batchDeleteBtn.textContent = `批量删除(成功${successCount}/${items.length})`;
      } catch (e) {
        appendLog(`删除失败：${item.title} -> ${e.message}`);
      }
    }
    appendLog(`已成功删除 ${successCount} 条草稿箱记录`);
    batchDeleteBtn.textContent = `批量删除`;
    batchDeleteBtn.disabled = false;
    window.location.reload();
  }

  // 删除单篇草稿箱记录的函数，接收appMsgId、token和referer参数
  async function deleteSingleCard(appMsgId, token, referer) {
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

  function injectMainButton() {
    const host = document.querySelector('#searchDiv');
    if (!host) { 
      appendLog('未找到#searchDiv容器，无法注入主按钮'); 
      return; 
    }
    if (document.getElementById('article-batch-delete-button')) return;
    const btn = document.createElement('button'); 
    btn.id = 'article-batch-delete-button'; 
    btn.textContent = '批量删除';
    btn.classList.add('weui-desktop-btn');
    btn.classList.add('weui-desktop-btn_primary');
    btn.style.marginLeft = '10px';
    btn.addEventListener('click', performBatchDelete); 
    host.parentElement.appendChild(btn);
    appendLog('主按钮“批量删除”已注入');

    // 优化草稿箱布局
    // 1. 去除”新的创作“按钮
    const newCreationBtn = document.querySelector('.weui-desktop-card.weui-desktop-card_new');
    if (newCreationBtn) {
      newCreationBtn.remove();
      appendLog('已移除“新的创作”按钮');
    } else {
      appendLog('未找到“新的创作”按钮，无需移除');
    }
    // 2. 调整草稿箱卡片布局，草稿标题只占一行
    const title = document.querySelectorAll('.weui-desktop-publish__cover__title');
    if (title.length) {
      title.forEach(item => {
        item.style.whiteSpace = 'nowrap';
      });
      appendLog('已调整草稿箱卡片布局，草稿标题只占一行');
    } else {
      appendLog('未找到草稿箱卡片标题，无需调整');
    }
  }

  function init() { appendLog('初始化文章发表记录批量管理脚本...'); injectMainButton(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  window.ArticlePublishRecordManager = { init, collectPublishedArticles};
})();
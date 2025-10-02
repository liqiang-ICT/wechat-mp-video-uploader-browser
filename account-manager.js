const fs = require('fs');
const path = require('path');

// 账号数据存储文件路径
const ACCOUNTS_DATA_FILE = path.join(__dirname, 'accounts-data.json');

// 账号信息结构
// {
//   id: string, // 账号唯一标识
//   name: string, // 公众号名称
//   wechatId: string, // 微信ID
//   avatar: string, // 头像URL或本地路径
//   lastLogin: string, // 最后登录时间
//   userDataDir: string // 用户数据目录路径
// }

/**
 * 初始化账号管理系统
 */
exports.initAccountManager = () => {
    // 确保账号数据文件存在
    if (!fs.existsSync(ACCOUNTS_DATA_FILE)) {
        fs.writeFileSync(ACCOUNTS_DATA_FILE, JSON.stringify([]), 'utf8');
    }
};

/**
 * 获取所有已保存的账号信息
 * @returns {Array} 账号信息数组
 */
exports.getAllAccounts = () => {
    try {
        const data = fs.readFileSync(ACCOUNTS_DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`读取账号数据失败: ${error.message}`);
        return [];
    }
};

/**
 * 获取指定ID的账号信息
 * @param {string} accountId - 账号ID
 * @returns {Object|null} 账号信息或null
 */
exports.getAccountById = (accountId) => {
    const accounts = exports.getAllAccounts();
    return accounts.find(account => account.id === accountId) || null;
};

/**
 * 添加新账号
 * @param {Object} accountInfo - 账号信息
 * @returns {boolean} 添加结果
 */
exports.addAccount = (accountInfo) => {
    try {
        const accounts = exports.getAllAccounts();
        
        // 生成唯一ID
        accountInfo.id = accountInfo.id || `account_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        accountInfo.lastLogin = new Date().toISOString();
        
        accounts.push(accountInfo);
        fs.writeFileSync(ACCOUNTS_DATA_FILE, JSON.stringify(accounts, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`添加账号失败: ${error.message}`);
        return false;
    }
};

/**
 * 更新账号信息
 * @param {string} accountId - 账号ID
 * @param {Object} updates - 要更新的字段
 * @returns {boolean} 更新结果
 */
exports.updateAccount = (accountId, updates) => {
    try {
        const accounts = exports.getAllAccounts();
        const accountIndex = accounts.findIndex(account => account.id === accountId);
        
        if (accountIndex === -1) {
            return false;
        }
        
        accounts[accountIndex] = { ...accounts[accountIndex], ...updates };
        fs.writeFileSync(ACCOUNTS_DATA_FILE, JSON.stringify(accounts, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`更新账号信息失败: ${error.message}`);
        return false;
    }
};

/**
 * 更新账号最后登录时间
 * @param {string} accountId - 账号ID
 * @returns {boolean} 更新结果
 */
exports.updateAccountLastLogin = (accountId) => {
    return exports.updateAccount(accountId, {
        lastLogin: new Date().toISOString()
    });
};

/**
 * 删除账号
 * @param {string} accountId - 账号ID
 * @returns {boolean} 删除结果
 */
exports.deleteAccount = (accountId) => {
    try {
        const accounts = exports.getAllAccounts();
        const filteredAccounts = accounts.filter(account => account.id !== accountId);
        
        if (accounts.length === filteredAccounts.length) {
            return false; // 没有找到要删除的账号
        }
        
        fs.writeFileSync(ACCOUNTS_DATA_FILE, JSON.stringify(filteredAccounts, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`删除账号失败: ${error.message}`);
        return false;
    }
};

/**
 * 创建账号的用户数据目录
 * @param {string} accountId - 账号ID
 * @returns {string} 用户数据目录路径
 */
exports.createUserDataDir = (accountId) => {
    const baseUserDataDir = path.join(__dirname, 'user-data');
    const userDataDir = path.join(baseUserDataDir, accountId);
    
    // 确保目录存在
    if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
    }
    
    return userDataDir;
};

/**
 * 从页面获取公众号信息
 * @param {Page} page - Puppeteer页面对象
 * @returns {Promise<Object>} 公众号信息
 */
exports.getAccountInfoFromPage = async (page) => {
    try {
        return await page.evaluate(() => {
            // 尝试从页面获取公众号信息
            let name = '未知公众号';
            let wechatId = 'unknown';
            let avatar = '';
            
            // 扩展选择器以匹配微信公众号最新页面结构
            // 尝试从不同位置获取公众号名称
            const nameElements = document.querySelectorAll('.weui-desktop-person_info .weui-desktop_name, .account_box-body .acount_box-nickname');
            if (nameElements.length > 0) {
                for (const el of nameElements) {
                    if (el.textContent && el.textContent.trim()) {
                        name = el.textContent.trim();
                        break;
                    }
                }
            }
            
            // 尝试获取微信ID
            try {
                // 直接从微信js数据中获取微信ID
                // 注意：这里假设微信js数据已经加载完成
                wechatId = wx.data.user_name;
            } catch (error) {
                console.error(`获取微信ID失败: ${error.message}`);
            }
            
            // 尝试获取头像
            const avatarElements = document.querySelectorAll('.weui-desktop-person_info .weui-desktop-account__img, .account_box-body .weui-desktop-account__thumb');
            if (avatarElements.length > 0) {
                // 尝试找到第一个有效的头像URL
                for (const el of avatarElements) {
                    const src = el.src || '';
                    // 过滤掉无效的或默认头像
                    if (src && src.includes('http') && !src.includes('default_avatar') && !src.includes('placeholder')) {
                        avatar = src;
                        break;
                    }
                }
            }
            
            return { name, wechatId, avatar };
        });
    } catch (error) {
        console.error(`从页面获取账号信息失败: ${error.message}`);
        return { name: '未知公众号', wechatId: 'unknown', avatar: '' };
    }
};

// 初始化账号管理器
exports.initAccountManager();
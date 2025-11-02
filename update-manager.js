const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

// 默认配置，可通过 update-config.json 覆盖
const DEFAULT_CONFIG = {
  // 托管在 GitHub 的清单地址（请替换为你的仓库路径或使用 set-url 命令）
  manifestUrl: 'https://cdn.jsdelivr.net/gh/<你的用户名>/<仓库名>@latest/update-manifest.json',
  // 需要检查更新的目录（仅 dist）
  watchDirs: ['dist'],
  // 忽略文件列表
  ignoreFiles: ['.DS_Store', 'user-data/*', '*.log', '*.bat', 'accounts-data.json']
};

function loadUserConfig() {
  try {
    const cfgPath = path.resolve('update-config.json');
    if (fs.existsSync(cfgPath)) {
      const obj = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      return { ...DEFAULT_CONFIG, ...obj };
    }
  } catch (e) {
    console.warn('加载 update-config.json 失败:', e.message);
  }
  return DEFAULT_CONFIG;
}

const CONFIG = loadUserConfig();

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function listFilesRecursive(rootDir) {
  const results = [];
  if (!fs.existsSync(rootDir)) return results;
  const walk = (dir) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full);
      } else {
        if (!CONFIG.ignoreFiles.includes(ent.name)) {
          results.push(full);
        }
      }
    }
  };
  walk(rootDir);
  return results;
}

// 生成更新清单
function generateManifest() {
  const manifest = { version: Date.now(), files: {} };
  
  CONFIG.watchDirs.forEach((dir) => {
    const files = listFilesRecursive(dir);
    for (const filePath of files) {
      const relPath = filePath.replace(/\\/g, '/'); // 统一为 / 分隔
      const buf = fs.readFileSync(filePath);
      manifest.files[relPath] = {
        hash: sha256(buf),
        size: buf.length
      };
    }
  });

  return manifest;
}

// 检查更新
async function checkUpdate() {
  try {
    if (!CONFIG.manifestUrl || !CONFIG.manifestUrl.includes('update-manifest.json')) {
      console.error('manifestUrl 未配置或格式不正确，请使用命令：node update-manager.js set-url <清单地址>');
      return [];
    }
    console.log('正在从远程清单检查更新...');
    const { data: remoteManifest } = await axios.get(CONFIG.manifestUrl, { timeout: 15000 });
    const localManifest = generateManifest();

    // 远程基础 URL，用于拼接文件下载地址
    const baseUrl = CONFIG.manifestUrl.replace(/update-manifest\.json$/, '');

    const updates = [];
    for (const [file, meta] of Object.entries(remoteManifest.files || {})) {
      const local = localManifest.files[file];
      if (!local || local.hash !== meta.hash) {
        updates.push({ file, url: `${baseUrl}${file}`, hash: meta.hash, size: meta.size });
      }
    }

    return updates;
  } catch (e) {
    console.error('检查更新失败:', e.message);
    return [];
  }
}

// 执行更新
async function runUpdate() {
  const updates = await checkUpdate();
  if (!updates.length) return console.log('当前已是最新版本');

  console.log(`发现 ${updates.length} 个待更新文件：`);
  for (const { file, url, hash } of updates) {
    try {
      console.log(`下载: ${url}`);
      const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
      const data = Buffer.from(resp.data);

      // 校验哈希
      const dlHash = sha256(data);
      if (hash && dlHash !== hash) {
        console.error(`校验失败: ${file}（期望 ${hash}，实际 ${dlHash}），已跳过`);
        continue;
      }

      // 确保目录存在并写入
      const dir = path.dirname(file);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, data);
      console.log(`✓ 已更新: ${file}`);
    } catch (e) {
      console.error(`更新失败: ${file} -> ${e.message}`);
    }
  }

  console.log('更新流程完成');
}

function setManifestUrl(url) {
  if (!url || !url.startsWith('https://')) {
    console.error('无效的 URL，请提供 https 地址');
    return;
  }
  const cfgPath = path.resolve('update-config.json');
  const newCfg = { ...CONFIG, manifestUrl: url };
  fs.writeFileSync(cfgPath, JSON.stringify(newCfg, null, 2));
  console.log('已写入 update-config.json');
}

function showConfig() {
  console.log('当前更新配置:');
  console.log(JSON.stringify(CONFIG, null, 2));
}

// 命令行接口
if (require.main === module) {
  const [command, arg] = process.argv.slice(2);
  switch (command) {
    case 'generate':
      fs.writeFileSync('update-manifest.json', JSON.stringify(generateManifest(), null, 2));
      console.log('已生成 update-manifest.json');
      break;
    case 'check':
      checkUpdate().then((updates) => {
        if (!updates.length) return console.log('当前已是最新');
        console.log('需要更新的文件列表:');
        updates.forEach(u => console.log(`- ${u.file}`));
      });
      break;
    case 'update':
      runUpdate();
      break;
    case 'set-url':
      setManifestUrl(arg);
      break;
    case 'config':
      showConfig();
      break;
    default:
      console.log('可用命令:\n  generate    生成清单\n  check       检查更新\n  update      执行更新\n  set-url     设置远程清单地址\n  config      显示当前配置');
  }
}

module.exports = { generateManifest, checkUpdate, runUpdate, setManifestUrl, showConfig };
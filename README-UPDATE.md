# 免费在线更新机制（GitHub + jsDelivr）

本方案实现：
- 通过命令生成 `update-manifest.json`（仅扫描 `dist/` 目录，生成文件哈希与大小）；
- 将清单与打包产物推送到 GitHub 仓库，使用 jsDelivr 免费托管；
- 用户通过命令行脚本检查更新并下载替换最新文件；
- 支持通过 `update-config.json` 或命令行设置远程清单地址；
- 下载后进行 SHA256 校验，保障正确性。

## 仓库与托管
- 使用公开 GitHub 仓库，例如：`<你的用户名>/<仓库名>`。
- 将前端打包输出（`dist/`）与生成的 `update-manifest.json` 推送到主分支。
- 通过 jsDelivr CDN 访问最新版本：
  - 清单地址示例：`https://cdn.jsdelivr.net/gh/<你的用户名>/<仓库名>@latest/update-manifest.json`
  - 文件地址示例：`https://cdn.jsdelivr.net/gh/<你的用户名>/<仓库名>@latest/dist/app.js`

## 生成更新清单
- 命令：`npm run update:generate`
- 行为：递归扫描 `dist/` 下全部文件，生成哈希与大小，并写入 `update-manifest.json`。
- 如需调整扫描目录，编辑 `update-config.json` 的 `watchDirs` 字段（默认仅 `["dist"]`）。

## 配置清单地址
可选两种方式：
- 编辑 `update-config.json`：
```json
{
  "manifestUrl": "https://cdn.jsdelivr.net/gh/<你的用户名>/<仓库名>@latest/update-manifest.json",
  "watchDirs": ["dist"],
  "ignoreFiles": [".DS_Store"]
}
```
- 使用命令：
```
node update-manager.js set-url https://cdn.jsdelivr.net/gh/<你的用户名>/<仓库名>@latest/update-manifest.json
```

## 检查与更新
- 检查更新：`npm run update:check`
  - 对比本地与远程清单，输出需要更新的文件列表。
- 执行更新：`npm run update:run`
  - 逐个下载远程文件并覆盖到本地相同相对路径；
  - 对下载内容计算 SHA256 并与远程清单哈希对比，校验失败会跳过该文件。

## 工作流建议
1. 本地构建，运行 `npm run update:generate` 生成 `update-manifest.json`。
2. 将 `dist/` 与 `update-manifest.json` 推送到 GitHub 主分支。
3. 用户侧运行 `npm run update:check` / `npm run update:run` 获取最新更新。

## 清单格式
`update-manifest.json` 示例：
```json
{
  "version": 1720000000000,
  "files": {
    "dist/app.js": { "hash": "<sha256>", "size": 12345 },
    "dist/vendor.js": { "hash": "<sha256>", "size": 67890 }
  }
}
```
- `files` 的键为文件相对路径（统一 `/` 分隔）。
- jsDelivr 文件下载地址由清单地址去掉 `update-manifest.json` 后拼接相对路径得到。

## 注意事项
- 确保 GitHub 仓库为公开仓库，便于 jsDelivr 访问。
- 更改输出目录结构后需重新生成清单并推送。
- 若更新量较大，建议分批次推送，减少用户侧首次更新耗时。
- 如需替换到其他免费平台（GitHub Releases、Cloudflare R2 公开桶等），保持清单与路径拼接逻辑一致，并将 `manifestUrl` 切换到对应地址。
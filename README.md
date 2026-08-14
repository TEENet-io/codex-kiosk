# Codex Only Local for Windows

这是一个研究性质的非官方 Codex Windows 重打包项目。

本仓库从 Microsoft Store 的官方 Codex/ChatGPT Windows 包构建安装程序，并应用版本锁定补丁：

- 启动后固定进入 Codex；
- 隐藏或阻止切换到 ChatGPT 产品界面；
- 编辑器任务固定为本地 Codex 模式；
- 禁用云端任务列表、云端任务详情和云任务创建入口；
- 使用 `Codex.vbs` 无控制台启动，桌面图标不会弹出黑色 CMD；
- 保留本地任务、终端、文件编辑、MCP、技能和插件等 Codex 基础能力。

> “本地任务”表示任务在本机工作区和本机 app-server 中执行，不表示模型推理完全离线。使用 OpenAI 或其他在线模型仍然需要网络。完全离线推理需要另外配置兼容的本地模型 Provider。

## 交付形态

本仓库只产出**桌面版**：`config/codex-only-local.json` 中 `packaging.crossPlatformWeb` 为 `false`，
浏览器版 Gateway 不参与构建、不打包、不验证。`web-gateway/` 目录仍保留源码，
其中 `gateway/src/ipc/codex/capabilityContractData.cjs` 是桌面补丁 marker 清单的事实来源，
构建与验证都会读取它，**不可删除**。

Computer Use 完整保留，未做任何裁剪。

## 仓库结构

```text
.
├── .github/workflows/          # GitHub Actions 构建与监控
├── config/                     # 构建配置
├── docs/                       # 架构和模型配置文档
├── installer/                  # Inno Setup 安装器模板与语言文件
├── scripts/                    # 下载、补丁、打包、验证和测试脚本
├── web-gateway/                # 浏览器版 Gateway（本仓库已关闭，见下）
├── BUILDING.md                 # 完整环境准备与构建说明
├── CHANGELOG.md
├── package.json
└── README.md
```

以下目录均为可重新生成的构建产物，不应提交到 Git：

```text
build/
dist/
node_modules/
web-gateway/node_modules/
web-gateway/gateway/dist/
web-gateway/cache/
```

## 快速构建

要求 Windows 10/11 x64、PowerShell 7、Node.js 24 和 Inno Setup 6。

```powershell
npm ci
npm test
pwsh -NoProfile -File .\scripts\build-offline-package.ps1 `
  -ConfigPath .\config\codex-only-local.json `
  -RequireInstaller
```

产物位于：

```text
dist/codex-only-local/<版本>/
```

完整的环境安装、短路径构建、验证和 GitHub Actions 使用方法见 [BUILDING.md](BUILDING.md)。

## 安装包行为

- 安装后的桌面和开始菜单快捷方式调用 `wscript.exe + Codex.vbs`。
- `Codex.cmd` 只作为排错备用入口。
- `codex://` 协议、技能同步、Chrome Host 等扩展能力由安装器任务控制。
- 构建会生成可选的 `models-api.json`，用于 API Key、自定义 Provider 和 DeepSeek 等兼容场景。
- 安装器不会把仓库的构建缓存部署到用户电脑。

## 验证

```powershell
npm test

pwsh -NoProfile -File .\scripts\verify-offline-package.ps1 `
  -BuildMetadataPath .\dist\codex-only-local\<版本>\build-metadata.json `
  -ConfigPath .\config\codex-only-local.json `
  -RequireInstallerAsset
```

完整验证包括：

- PowerShell/JavaScript 静态检查；
- 补丁 marker 与残余模式检查；
- 安装包和便携包文件校验；
- renderer JavaScript 语法检查；
- 30 秒隔离配置桌面启动测试；
- app-server 与窗口初始化检查。

## 重要限制

- 该项目不是 OpenAI 官方发行版。
- 补丁与上游 bundle 结构绑定；上游前端改动后，构建会主动失败并要求重新适配。
  **Codex 每发布一个新版本，都可能需要一次补丁适配**，适配方法见
  [版本适配与维护](docs/版本适配与维护.md)。
- 构建取的是 Store 上的**当前最新版**，而灰度期间同一查询会随机返回不同版本，
  因此同一个 commit 重跑 CI 可能结果不同。当前已同时适配 26.803.10989.0 与 26.810.4967.0。
- CI 全绿只代表**补丁已正确应用**，不代表 ChatGPT 入口确实消失或 Computer Use 确实可用；
  这两点必须在 Windows 真机上人工验收。
- 重新打包后的程序不保留 Microsoft Store 原包签名。
- 不应绕过账户权限、组织策略、模型服务授权或软件许可。
- 发布前应在干净 Windows 虚拟机中完成安装、登录、本地任务、重启和卸载验收。

## 文档

- [构建环境与发布流程](BUILDING.md)
- [版本适配与维护](docs/版本适配与维护.md) — Codex 更新后如何适配补丁、本地复现方法、故障排查
- [Codex-only 架构与补丁说明](docs/codex-only-fork-github-actions.md)
- [API / 自定义 Provider 模型目录](docs/models-api.md)
- [变更记录](CHANGELOG.md)

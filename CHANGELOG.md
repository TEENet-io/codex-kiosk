## 企业预览 26.901.51231-enterprise-preview.1（2026-09-09）

- 升级到官方 Windows MSIX 26.901.6511.0，固定 SHA-256；整体替换桌面程序与 CLI，保留管理员配置生命周期和办公插件。
- 适配新版菜单、RPC、设置页、模型推广和 Windows 首启向导；继续保留对话/项目/归档/语音/外观/快捷键/模型切换/Skill。
- 企业构建跳过浏览器与 Computer Use 启用补丁；统一关闭新增浏览器能力，并移除统一控制、自动化应用工具和个性化写作插件。
- 修复新版归档分页、自定义模型名称和云任务限制的补丁匹配，更新包验证与 Windows 安装后测试。
- 规范化 MSIX 编码的 Node 模块路径，移除 Computer Use 专用依赖并检查安装目标长度，解决 Windows 安装回滚。
- 适配 Owl 将 Electron fuse 移至 chrome.dll 的布局，修复重打 ASAR 后启动时的完整性校验崩溃；增加构建验证，未知运行时布局不再静默跳过。
- 屏蔽操作保持新版侧栏原生菜单所需的子元素接口，修复首页 null props 错误；桌面测试增加错误页断言及渲染异常记录。
- 补齐新版模式/宠物/Activity 快捷键别名屏蔽，关闭不留历史的临时聊天；完整访问默认值迁移到 permissionProfile，并检查 CLI 有效配置和首页显示。

# Changelog

## Unreleased

### TEENet enterprise preview

- Added an independent preview build pinned to the SHA-256 of the published `26.810.52044-b1` portable package.
- Added a shared employee policy for desktop capabilities, native/renderer commands, settings routes, configuration writes and plugin management. The full settings shell is replaced with appearance, voice, keyboard shortcuts and archived chats.
- Removed browser/Chrome/Computer Use assets and employee setup utilities from the preview. Existing administrator model and Provider configuration is preserved; native bootstrap may initialize approved bundled office plugins.
- Employee startup skips personalization and model-promotion dialogs, the workspace-write sandbox wizard under the enforced full-access policy, and optional Codex Micro USB discovery.
- Added a separate preview installer, generated `block-list.md`, package verifier, regression tests and a Windows artifact workflow with desktop screenshots. No fleet deployment or GitHub Release is performed by this workflow.
- Default-model provisioning, project-aware conversation collection and gateway billing remain management-system integration checks, documented in `docs/enterprise-preview.md`.

### 中文

- 将每日上游探测与完整 Windows 打包拆开：每日 canary 只解析 Store 元数据，并按 MSIX
  发布批次（版本前两段）创建去重 Issue；同一批次的小版本不重复建单，完整打包改为仅手动触发。
- 新增不可变 `archive` 应用源，构建强制核对归档 MSIX 的 SHA-256 与清单版本。
- Store 解析和 MSIX HTTP 下载增加有限次数的退避重试，降低空列表与临时 504 导致的误报。
- Chrome native-pipe 结构漂移错误现在列出具体缺失锚点，便于拿到新版 bundle 后定向适配。
- 新增源稳定性回归测试；尚未宣称适配未取得原始 bundle 的 Codex 26.818 系列。

### Verification

- `node --test scripts/test/source-resilience.test.cjs`

## 2026-08-14

### 中文

- 新增版本锁定的 Codex-only 补丁：启动固定进入 Codex，左上角产品选择器不可切换，所有产品模式切换统一回落到 Codex。
- 编辑器任务位置固定为 `local`；禁用云任务列表和云任务详情查询，并从 `create_thread` 参数 schema 移除 `chatgptWorkCloud`，同时保留运行时拒绝作为纵深防护。
- 补丁 marker 纳入共享能力契约和离线包验证器；上游 bundle 结构变化导致任一必需补丁无法应用时，构建直接失败。
- “本地”表示任务在本机工作区和本机 app-server 执行，不代表模型推理离线；完全离线推理仍需配置本地模型 provider。

### Verification

- `107/107` repository tests passed.
- Store bundle `26.803.10989.0` patched and repacked successfully.
- Extracted renderer passed JavaScript syntax validation and contained all eight required markers.
- Codex-only portable, skills, and web artifacts were rebuilt successfully through a short-path build root; the complete package verifier and 30-second offline direct-launch smoke test passed.
- The native `setup.exe` was built successfully with Inno Setup 6.7.3. The complete package verifier and 30-second offline direct-launch smoke test passed against the installer-bearing build.
- The installer now embeds the bundled Codex/ChatGPT application icon instead of the default Inno Setup icon. Post-copy configuration runs PowerShell directly with `runhidden` and no longer opens a visible `Setup Codex.cmd` console during normal installation.
- Desktop and Start-menu shortcuts, post-install launch, and `codex://` links now use a console-free `wscript.exe` + `Codex.vbs` launcher. `Codex.cmd` remains available only as a troubleshooting fallback.

## 2026-08-12

### 中文

- 修复 Featured 等插件分类的“查看另外 N 个”入口无法进入完整分类页的问题：Gateway 与桌面运行时现在明确选择官方统一插件页，不再误入点击处理为空的旧版 storefront；仅对旧构建缓存执行定向迁移。
- 安装器新增“使用内置自定义 model 目录”选项；重新安装时取消勾选或卸载会清除安装器管理的目录文件及对应 `model_catalog_json`，不会删除其他 provider、API key 或用户自定义目录。
- 将插件服务断网降级迁移到 Gateway/桌面 IPC 的共享兼容核心，renderer 只保留通用离线查询策略。
- 将传递依赖 `brace-expansion` 更新到 `5.0.9`，修复 npm audit 报告的 high 级拒绝服务漏洞。

### English

- Fixed Featured and other plugin-category “see more” rows failing to open the complete category view. The Gateway and desktop runtime now explicitly select the official unified plugins page instead of the legacy storefront whose click handler is empty; only previously patched build caches receive a targeted migration.
- Added an installer option for the bundled custom model catalog. Unchecking it on a later install or uninstalling removes only the installer-managed catalog and its `model_catalog_json` entry, preserving other providers, API keys, and user catalogs.
- Moved plugin-service network fallback into a shared Gateway/desktop IPC compatibility core; the renderer now keeps only the generic offline query policy.
- Updated the transitive `brace-expansion` dependency to `5.0.9`, resolving the high-severity denial-of-service advisory reported by npm audit.

### Verification

- `node --test scripts/test/*.test.cjs web-gateway/gateway/test/*.test.cjs`
- Gateway TypeScript build
- Current-bundle patch against Codex `26.803.10989.0`
- Full installer and portable package build
- Offline package verification and desktop direct-launch smoke test

## 2026-08-09

### 中文

- 修复系统离线或 Windows 仍报告在线但外网被策略拒绝（如 `net::ERR_NETWORK_ACCESS_DENIED`）时，插件页遮蔽本地和内网市场的问题；明确的 Chromium 网络不可达错误会让云端目录降级为空结果，本地插件查询与安装保持可用。
- 恢复离线状态下 Activity 视图的优先级筛选入口，并让 Skills 页面继续加载本地插件管理数据。
- 不再强制开启依赖云服务的远程连接功能开关，避免离线界面暴露不可用入口。
- 将完整脚本回归测试纳入发布工作流，覆盖离线 UI、插件市场和模型目录补丁。

### English

- Fixed local and intranet marketplaces being hidden when Windows reports online while external access is policy-blocked (for example, `net::ERR_NETWORK_ACCESS_DENIED`), as well as when Windows reports offline. Known Chromium network-unavailable errors now degrade cloud catalogs to empty results while local plugin queries and installs remain runnable.
- Restored the Activity priority filter while offline and kept local plugin-management data loading on the Skills page.
- Stopped forcing cloud-only remote connection gates in offline builds, avoiding unusable UI entries.
- Added the complete script regression suite to the release workflow, covering offline UI, plugin marketplace, and model-catalog patches.

### Verification

- `node --test scripts/test/*.test.cjs`
- `node --test web-gateway/gateway/test/*.test.cjs`
- `npm --prefix web-gateway run build:gateway`
- Full installer and portable package build for Codex `26.803.5235.0`
- Offline package verification and direct-launch UI smoke test

## 2026-08-08

### 中文

- 每个 Release 现在额外提供一个与包内 Codex CLI 精确匹配的 `models-api.json`，合并 DeepSeek 官方条目，并为 GPT-5.6 custom provider 搜索问题提供受校验的临时目录覆盖。
- 恢复 Activity View 的优先级筛选入口，并让 Fast 模式在离线/API Key 场景保持可见可选。
- 兼容 Codex `26.803.5235.0` 的 Chrome native pipe、平台分发器和运行时环境变量读取结构，修复最新版无法生成离线包的问题。
- 增加当前 bundle 结构与离线 UI gate 的回归测试。

### English

- Each Release now includes a `models-api.json` catalog matched to the bundled Codex CLI, combining official DeepSeek entries with a guarded temporary GPT-5.6 custom-provider compatibility override.
- Restored the Activity View priority filter and kept Fast mode available in offline/API-key sessions.
- Added compatibility for Codex `26.803.5235.0` Chrome native-pipe, platform-dispatch, and runtime environment-reader shapes, fixing offline package generation for the latest release.
- Added regression coverage for the current bundle structure and offline UI gates.

### Verification

- `node --test scripts/test/api-model-catalog.test.cjs`
- `node --test scripts/test/*.test.cjs`
- `npm --prefix web-gateway run build:gateway`
- Full installer and portable package build for Codex `26.803.5235.0`
- Offline package verification and 30-second direct-launch smoke test

## 2026-05-17

### English

- Added `Codex Web.cmd`, a localhost-first browser gateway for the offline package.
- Simplified the web path into a local shell around the packaged Codex renderer and app-server. The package no longer carries the extra Electron compatibility runtime, generated channel registry, or duplicated app-name registration layer.
- Removed external source branding from the web shell UI and storage keys. The browser entrypoint now presents itself as `Codex Offline`.
- Packaging now builds and copies the web gateway runtime into `_internal\web`, and the verifier checks the browser launcher, gateway files, and package history file.

### 中文

- 新增 `Codex Web.cmd`，作为离线包的本地优先浏览器 gateway。
- 将 Web 路径收敛成“本地运行壳”：浏览器访问包内 Codex renderer，gateway 桥接到包内 app-server；不再随包携带额外 Electron 兼容运行时、生成式 channel registry 或重复的应用名称登记层。
- 清理 Web 壳 UI 和存储键里的外部来源标识；浏览器入口现在统一显示为 `Codex Offline`。
- 打包流程会构建并复制 Web gateway 运行时到 `_internal\web`，校验脚本会检查浏览器启动器、gateway 文件和历史记录文件。

### Verification

- `npm --prefix web-gateway run build:gateway`
- `node --check web-gateway/start-web.mjs`
- `pwsh -NoProfile -File ./scripts/build-offline-package.ps1 -SkipInstaller -MetadataOutputPath ./build/tmp/web-refactor-build-metadata.json`
- `pwsh -NoProfile -File ./scripts/verify-offline-package.ps1 -BuildMetadataPath ./build/tmp/web-refactor-build-metadata.json`
- Browser smoke on `http://127.0.0.1:3744`

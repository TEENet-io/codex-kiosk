## Codex 26.901.51231-b6（待 Windows 验收）

- 取消 app-server 与 composer 的强制完全访问默认值，恢复上游权限选择与 Windows 沙箱设置；“请求批准”使用 workspace/read-only 回退。
- 创建项目仅保留本地选项，隐藏远程及云端入口。
- 增加 Windows 宠物原生点击、拖动及透明区域后方按钮点击的验收。
- Windows 不支持 input shape 时使用原生光标与宠物控件区域决定鼠标穿透，避免依赖失效的转发悬停事件或残留悬停状态。
- Windows 宠物窗口停用原生透明度淡入淡出，避免 Electron 保留 WS_EX_LAYERED 导致可见宠物收不到鼠标；保留显示、收起及动画。候选仍须通过系统鼠标验收。
- 原生窗口标志修复放在随宠物退出的 Node 辅助进程中，限定目标 HWND 归属，失败时保留鼠标穿透。Windows 对照 34444932028 已通过点击、拖动、透明区域后方按钮与聊天回归；新 b6 安装包仍在验收。

## Codex 26.901.51231-b5（2026-09-09）

- 按用户要求恢复宠物偏好页、菜单、快捷键、悬浮窗及启动恢复，撤销 b3 临时隔离；保留命令注册修复和返回按钮修复。使用新包验证已有开启状态恢复及显示/收起。
- 修复偏好页左上角“返回对话”鼠标点击无效：按钮位于 Electron 顶部拖动区域，缺少 `no-drag`。沿用现有 CSS 类明确排除按钮点击区域，不改导航目标、窗口路由或用户配置。
- Windows 原生鼠标对照 34368987734 在 b4 上复现点击未到达按钮，临时排除拖动区域后返回对话成功。新包验收使用系统鼠标，覆盖应用内进入偏好和原生设置入口重新加载后的返回，并检查输入框可继续输入；截图等待外观内容就绪。

- Windows 构建 34370298624 的回归、网关检查、包验证及英文交互通过。中文首次返回点击失败；复测 34371748817 确认测试脚本误选宠物窗口，按主界面尺寸定位后，同一安装包的返回、模型切换、宠物启动恢复和显示/收起全部通过，两组无 renderer/console 错误。测试修正未修改分发程序；下载和 SHA256 见交付记录。

## Codex 26.901.51231-b4（2026-09-09，候选）

- b3 关闭宠物后，员工 trace 仍沿 `Pas/Ras` 命令注册链触发 React #185。新增固定版本回归证明：即使模型投影已缓存，禁用命令的其他依赖持续换引用时仍会循环。
- 在 26.901 的 `Ras` 注册与清理处保留无变化数组的引用；启用命令的回调替换、排序、模型刷新和移除仍正常通知。保留 b2 模型缓存和 b3 宠物屏蔽，不改用户配置或凭据。该回归覆盖新增触发条件，尚不等于完整复现员工机器状态。
- 临时异常采集器捕获已定位的 React #185 后立即停止附加，并降低异常数量上限，避免重试时持续暂停 React 的诊断堆栈生成；采集器独立于分发应用。
- Windows CI 34367229919 构建、回归、安装及中英文交互检查通过。随后用户确认：清空旧 `.codex`，仅放回 config、model 和 auth 即恢复正常，未依赖 b4；据此将现场问题保留为旧持久状态相关，不能把 b4 当作已验证的现场根因修复。不再启动额外对照测试，也不要求用户继续升级。

## Codex 26.901.51231-b3（2026-09-09）

- 用户反馈 b2 仍无法启动，按要求临时屏蔽宠物以隔离故障；不宣称宠物已被证实为根因。
- 统一策略关闭宠物 gate、入口、命令与消息；固定 26.901 原生管理器停止状态恢复和预加载，窗口获取返回调用方已支持的 null，避免隐藏悬浮窗仍启动。
- 保留模型、凭据、会话和原宠物状态文件；Windows 构建与验收 34361590519 全部通过，包含旧状态为开启时不创建宠物 renderer、中文 DeepSeek → Kimi → DeepSeek 切换、配置与 Skill 保留。员工现场是否恢复仍需安装 b3 验证。

## Codex 26.901.51231-b2（2026-09-09）

- 员工异常 trace 定位到 React #185（更新层级过深）：命令注册布局 effect 写入 store 后递归更新，随后被合并为无消息的 AggregateError。`pUr` 的 invalid-hook 异常属于 React 重建组件堆栈，不能单独当作根因。
- 固定 26.901 的模型命令组件对模型投影结果做按输入缓存，避免不变的模型目录生成新依赖并持续重新注册。回归使用该版本实际组件与注册 hooks，原代码可触发循环，修复后稳定且模型刷新/选择仍有效。
- Windows 132 项回归、18 项网关测试、打包验证和安装后中英文界面检查通过（34339897422）；覆盖 Provider bearer、宠物启动恢复、输入框及用户配置/Skill 保留。实际员工完整状态尚需回测；没有创建正式 Release。
- 新增临时 Windows 异常采集工具，只记录函数名和代码位置；退出后恢复原始 `patches/init.cjs`，不改 ASAR、模型配置或用户数据。
- 修复独立的启动插件清理策略问题：仅允许原生启动流程卸载本包明确移除的 bundled 插件，员工操作和其他插件仍受原有规则限制。此项不作为 AppRoutes 崩溃的修复结论。

## Codex 26.901.51231-b1（2026-09-09）

- 安装包、快捷方式和安装程序恢复 Codex 名称，默认安装到用户目录下的 Codex，沿用旧安装器 AppId 和已有安装位置。
- 升级时替换程序目录，避免旧 8xx 原生文件残留；保留用户配置、凭据、模型目录和 Skills。保留精简功能与宠物。
- Windows 全量回归、网关构建与测试、安装后七页和宠物检查通过（CI 34332567479）；覆盖安装检查确认旧程序文件清理与用户 Skill 保留。
- 使用员工八个模型条目的独立诊断在 API Key、仅 Provider bearer 和过期 ChatGPT 凭据三种状态下通过（测试包为 preview.2，CI 34332556000）。尚未复现员工机器的 AppRoutes 异常，本次更名不代表该问题修复完成。

## 企业预览 26.901.51231-enterprise-preview.2（2026-09-09）

- 按试用反馈恢复宠物悬浮层、资料菜单中的显示/隐藏入口及宠物快捷键，精简偏好页增加「宠物」。
- 去掉「默认权限：完整访问 · 模型与连接由管理员统一配置」提示文字；默认权限和管理员配置策略不变。
- 插件入口已确认存在；Skills 设置页继续隐藏，Skill 使用与创建能力保留。
- 新包 Windows 安装、宠物显示/收起与七页截图检查通过（CI 34328652505）；preview.1 的下载不包含本次改动。

## 企业预览 26.901.51231-enterprise-preview.1（2026-09-09）

Windows 预览验收通过：125 项回归、18 项网关测试、安装与六个页面检查。改动、下载、摘要及联调边界见 [完整改动清单](docs/enterprise-change-inventory.md)。

- 升级到官方 Windows MSIX 26.901.6511.0，固定 SHA-256；整体替换桌面程序与 CLI，保留管理员配置生命周期和办公插件。
- 适配新版菜单、RPC、设置页、模型推广和 Windows 首启向导；继续保留对话/项目/归档/语音/外观/快捷键/模型切换/Skill。
- 企业构建跳过浏览器与 Computer Use 启用补丁；统一关闭新增浏览器能力，并移除统一控制、自动化应用工具和个性化写作插件。
- 修复新版归档分页、自定义模型名称和云任务限制的补丁匹配，更新包验证与 Windows 安装后测试。
- 规范化 MSIX 编码的 Node 模块路径，移除 Computer Use 专用依赖并检查安装目标长度，解决 Windows 安装回滚。
- 适配 Owl 将 Electron fuse 移至 chrome.dll 的布局，修复重打 ASAR 后启动时的完整性校验崩溃；增加构建验证，未知运行时布局不再静默跳过。
- 屏蔽操作保持新版侧栏原生菜单所需的子元素接口，修复首页 null props 错误；桌面测试增加错误页断言及渲染异常记录。
- 补齐新版模式/宠物/Activity 快捷键别名屏蔽，关闭不留历史的临时聊天；完整访问默认值迁移到 permissionProfile，并检查 CLI 有效配置和首页显示。
- 旧权限界面尚未切换到 permission-selection rollout 时，也为新聊天预选服务器允许的完整访问，避免界面忽略 CLI 默认权限。

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

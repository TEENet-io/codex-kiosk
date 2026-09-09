# TEENet 企业版 Codex 完整改动清单

本文件记录企业精简版已实现的改动、保留能力、对应代码及尚未完成的集成项。需求依据为 2026-09-08 TEENet 周会；最近更新：2026-09-09。

适用版本：`26.901.51231-enterprise-preview.2`。这是单机试用预览包，尚未通过 ai-env-mgr 发布到员工机队。

## 1. 版本与构建来源

| 项目 | 内容 |
| --- | --- |
| 维护分支 | `enterprise/employee-preview` |
| 官方应用版本 | `26.901.51231` |
| 官方 Windows x64 MSIX | `26.901.6511.0` |
| 官方来源 | `https://persistent.oaistatic.com/codex-app-prod/ChatGPT-x64.msix` |
| 原始 MSIX SHA-256 | `fd9ae9eeeeaf11577191ce5a39d0b8f95fa73d591aa3a94f688b84d294d1fa85` |
| 旧版载体 | `offline-v26.810.52044-b1`，仅取安装辅助文件、启动器、模型目录、Skill 种子与固定办公插件 |
| 旧载体 SHA-256 | `2894d4c38e86aa24450567aeb2c631e9f82bf911b375652490aa5f2a6071c887` |
| 更新方式 | 手动调整固定版本与摘要后重新适配、打包、验收；员工包不追随官方自动升级 |

构建时删除载体中的整套 `_internal/app`，替换为新版官方 app，包含 EXE、CLI、原生模块和前端资源。旧版桌面程序与 DLL 不混入新版。构建先规范化 MSIX 中编码后的 Node 模块目录，确保 app.asar 的原生依赖引用能够正确解析；企业版另行关闭 USB 硬件探测。

官方稳定下载地址会变化。构建必须校验上述 SHA-256，不匹配就失败；下次重建应使用归档的同版本 MSIX，不能直接放宽摘要检查。

配置见 [enterprise-preview.json](../config/enterprise-preview.json)，流程见 [build-enterprise-preview.mjs](../scripts/build-enterprise-preview.mjs)。

## 2. 功能改动总表

“已实现”指代码及构建策略已落地；Windows 验收结果单列在第 7 节，后台联调不能以界面可见代替。

| 功能 | 最终行为 | 实现与边界 |
| --- | --- | --- |
| 完整设置 | 屏蔽，改为“外观与快捷键”精简页面 | 只允许外观、语音、快捷键、归档、宠物五个设置子路由；默认打开外观 |
| 模型、连接、隐私等管理配置 | 沿用管理员配置，员工不能从客户端改管理项 | 拦截配置写入 RPC；保留模型、推理强度、推理摘要和服务档位的会话模型操作 |
| 账户管理 | 收起登录切换、退出、账户/工作区管理等员工入口 | 不捆绑员工密钥，不跳过必要的认证；管理员仍须下发有效配置与凭据 |
| Worktree / 编码环境 | 隐藏入口、命令、快捷操作及相关原生管理处理器 | 屏蔽创建 Worktree、工作环境保存、远程安装等；普通项目目录和文件能力保留 |
| 连接管理 | 不允许员工新增/授权远程连接 | 屏蔽 SSH、远程控制、WSL 连接管理及 MCP OAuth 登录入口/RPC |
| Computer Use / 浏览器 | 关闭 | 进程环境、桌面 feature、Statsig gate、命令、消息处理、CLI 插件覆盖及插件文件共同限制 |
| 浏览器配置同步 | 禁用 | 阻止扩展同步及浏览器 MCP 自动重写，避免修改管理员已有配置 |
| 个性化 | 隐藏 | 关闭个性化入口、首启问卷、侧栏自定义及相关推广；宠物按试用反馈恢复 |
| 导入导出 | 隐藏 | 关闭外部 Agent 配置导入、配置编辑、主题导入导出等配置入口；不删除正常聊天生成文件能力 |
| 自动化及高级入口 | 隐藏 | 收起 Scheduled/Heartbeat、PR、Scratchpad、Chronicle、浏览器页、调试等非员工必需入口 |
| 归档聊天 | 保留归档/恢复 | 在精简偏好页提供归档入口；适配本地归档分页与离线错误处理 |
| 快捷键 | 保留普通快捷键与查看页面 | 删除受限功能对应的命令；保留新建对话、模型选择、语音等正常操作 |
| 宠物 | 保留 | 恢复悬浮层、显示/隐藏菜单与快捷键；精简偏好页提供宠物选择和大小调整 |
| 语音 | 保留 | 保留语音页面与快捷键；隐藏屏幕上下文等高级控制选项；真实语音服务仍需员工环境联调 |
| 外观 | 保留 | 精简页面可访问；配置类的主题导入导出隐藏 |
| 默认权限 | 预设完整访问 | 26.901 app-server 使用 `default_permissions=":danger-full-access"`、`approval_policy="never"`，兼容新版权限档案及前端默认选择；旧版使用 legacy sandbox 参数。验证 CLI 有效配置和首页权限，不改管理员配置文件 |
| 对话 / 项目 | 保留本地 Codex 模式 | 保留会话、项目、普通文件与终端能力；限制切换到 Work/Chat 与云任务创建/查询 |
| 模型切换 | 保留 | 默认模型读取现有管理员配置；修复自定义模型名称回退及模型可用性兼容；不擅自替换企业默认模型 |
| 插件页 | 保留但受控 | 员工不能安装/卸载插件、添加市场、分享管理插件；原生启动仅能从可信内置市场安装允许的插件 |
| 办公插件 | 保留管理员预装的办公运行时 | documents、spreadsheets、presentations；既有允许的 latex、deep-research、visualize、sites 策略保留 |
| Skill 创建 | 保留 | 安装时提供 Skill 创建种子，保留对应入口和能力 |
| 会话文件 | 保留原位置 | 沿用 `CODEX_HOME` 或用户 `.codex`，不迁移或删除原有会话 |
| 对话回收 / 项目归属落库 | 待后台联调 | ai-env-mgr 已有文件采集；本次桌面改造未实现项目归属入库、审计后台或网关计费校准 |

企业策略的唯一来源是 [policy.cjs](../scripts/enterprise/policy.cjs)。精简页面见 [preferences.js.txt](../scripts/enterprise/preferences.js.txt)。

### 2.1 按程序原生设置项逐项对照

依据官方 `26.901.51231` 的设置注册表（`app-initial-f87238153a19.js` 中的 `SSo`）和设置菜单分组逐项列出，共 **34 项**。名称附英文原名，中文为便于对照的译名；原版会按账号、模式及功能开关决定是否展示，不代表某个账号能同时看到全部项目。企业策略以本仓库 `policy.cjs` 为准。

下表描述 **preview.2**：开放 5 个精简偏好页，屏蔽其余 29 个设置页。preview.1 只有 4 个开放页，宠物尚未恢复；各包验收与下载见第 7 节。“屏蔽设置页”仅指设置入口和路由，不自动表示底层功能被关闭。

| 原生分组 | 程序设置项 | 设置路由 `/settings/…` | 企业版状态 | 说明 |
| --- | --- | --- | --- | --- |
| 个人 | 常规 General | `general-settings` | 屏蔽设置页 | 默认权限仍为完整访问；管理配置由管理员预设 |
| 个人 | 通知 Notifications | `notifications` | 屏蔽设置页 | 不等于关闭所有通知 |
| 个人 | 导入 Import | `import` | 屏蔽 | 外部配置导入关闭 |
| 个人 | 个人资料 Profile | `profile` | 屏蔽设置页 | 资料管理入口隐藏 |
| 个人 | 外观 Appearance | `appearance` | 保留 | 在精简偏好页开放；主题导入导出隐藏 |
| 个人 | 安全与登录 Security and login | `security` | 屏蔽设置页 | 安全及登录管理不开放给员工 |
| 个人 | 账户 Account | `account` | 屏蔽设置页 | 管理员统一开号和配置 |
| 个人 | 语音 Voice | `voice` | 保留 | 语音设置及快捷键保留；屏幕上下文控制关闭 |
| 个人 | 存储 Storage | `storage` | 屏蔽设置页 | 不删除原有会话或文件 |
| 个人 | 配置 Configuration | `agent` | 屏蔽设置页 | 模型与连接等管理配置统一预设，聊天模型切换保留 |
| 个人 | 个性化 Personalization | `personalization` | 屏蔽 | 个性化配置与首启问卷关闭 |
| 个人 | 宠物 Pets / Mini | `pets` | 保留（preview.2 恢复） | 精简偏好页增加「宠物」，恢复悬浮层、显示/隐藏入口及快捷键 |
| 个人 | 快捷键 Keyboard shortcuts | `keyboard-shortcuts` | 保留 | 受限功能的快捷键移除，普通操作与宠物快捷键保留 |
| 个人 | 用量 Usage | `usage` | 屏蔽设置页 | 用量设置入口隐藏 |
| 个人 | 分析 Analytics | `analytics` | 屏蔽设置页 | 分析设置入口隐藏，不代表对话回收已完成 |
| 个人 | 消费者视图 Consumer view | `consumer-view` | 屏蔽设置页 | 不向员工开放 |
| 个人 | 调试 Debug | `debug` | 屏蔽设置页 | 调试入口和命令关闭 |
| 集成 | 电脑控制 Computer use | `computer-use` | 关闭 | 同时限制能力、消息、插件及专用运行时 |
| 集成 | Chronicle | `chronicle` | 屏蔽 | 不向员工开放 |
| 集成 | Appshots | `appshots` | 屏蔽 | 应用截图上下文入口关闭 |
| 集成 | Codex Micro | `codex-micro` | 屏蔽 | 关闭硬件设置入口和 USB 探测 |
| 集成 | MCP 服务器 MCP servers | `mcp-settings` | 屏蔽设置页 | 员工不能自建或授权连接；管理员现有配置沿用 |
| 集成 | 插件 Plugins | `plugins-settings` | 屏蔽设置页 | **主界面插件页保留**；员工安装/卸载与市场管理受控 |
| 集成 | 技能 Skills | `skills-settings` | 屏蔽设置页 | **Skill 使用和创建能力保留**，通过主界面插件/Skills 入口使用 |
| 集成 | 浏览器 Browser | `browser-use` | 关闭 | 浏览器控制、扩展及配置同步关闭 |
| 编码 | Hooks | `hooks-settings` | 屏蔽设置页 | 不开放 Hook 管理 |
| 编码 | 连接 Connections | `connections` | 屏蔽 | SSH、WSL、远程连接管理关闭 |
| 编码 | 云偏好 Cloud preferences | `cloud-settings` | 屏蔽设置页 | 本地 Codex 模式保留 |
| 编码 | 云环境 Cloud environments | `cloud-environments` | 屏蔽设置页 | 不开放云环境配置 |
| 编码 | 代码审查 Code review | `code-review` | 屏蔽设置页 | 审查面板与 PR 入口收起 |
| 编码 | Git | `git-settings` | 屏蔽设置页 | Git 管理命令隐藏；不删除项目目录 |
| 编码 | 环境 Environments | `local-environments` | 屏蔽 | 不开放本地编码环境配置 |
| 编码 | 工作树 Worktrees | `worktrees` | 屏蔽 | 不开放 Worktree 创建和管理 |
| 归档 | 归档聊天 Archived chats / Data controls | `data-controls` | 保留 | 收敛为精简偏好页「归档对话」，支持归档和恢复 |

完整设置页替换为「外观与快捷键」，其中提供：**外观、语音、快捷键、归档对话、宠物**。已按试用反馈删除“默认权限：完整访问 · 模型与连接由管理员统一配置”提示文字，实际默认权限和配置策略不变。

主界面插件页与 `plugins-settings` 是两个入口，不能混为一谈。Skills 同理；保留使用和创建不要求开放整套 Skills 设置页。

## 3. 屏蔽如何落实

| 层次 | 具体改动 | 文件 |
| --- | --- | --- |
| 原生菜单与命令注册 | 从命令表删除受限命令；原生菜单引用已删除命令时返回隐藏菜单项，避免启动报错 | [patch-bundle.mjs](../scripts/enterprise/patch-bundle.mjs)、[runtime.cjs](../scripts/enterprise/runtime.cjs) |
| React 界面 | 在 JSX 创建与国际化标签边界移除受限按钮/菜单/设置字段，保留相邻正常操作 | [policy.cjs](../scripts/enterprise/policy.cjs) |
| 路由 | 设置只开放五个精简页面；编码后的路径、额外子路由及受限页面不能绕过 | 同上 |
| 员工请求 | 原生消息入口和 renderer RPC 边界拒绝插件管理、账户管理、连接配置及非允许配置写入 | [patch-bundle.mjs](../scripts/enterprise/patch-bundle.mjs) |
| 原生插件初始化 | 仅允许指定插件从准确匹配的内置市场路径安装，兼容 Windows 长短路径及市场 manifest 路径 | [native-policy.cjs](../scripts/enterprise/native-policy.cjs)、[policy.cjs](../scripts/enterprise/policy.cjs) |
| 桌面能力与 gate | 静态 bundle 和运行时均应用相同企业策略，旧的用户开关不能重新打开受限功能 | [patch-app-asar.mjs](../scripts/patch-app-asar.mjs)、[init.cjs](../scripts/desktop-patches/init.cjs) |
| app-server 启动 | 注入完整访问、关闭受限内置插件；已有 node_repl MCP 存在时仅通过启动参数禁用，不制造无效配置 | [runtime.cjs](../scripts/enterprise/runtime.cjs)、[policy.cjs](../scripts/enterprise/policy.cjs) |
| 包内容 | 删除被禁插件、Chrome 扩展、浏览器修复工具、重新配置脚本与环境工具 | [build-enterprise-preview.mjs](../scripts/build-enterprise-preview.mjs) |

完整访问和 Skill 创建按会议要求保留，因此上述应用内限制不是操作系统级防篡改或软件执行白名单。管理员对终端及配置文件的保护仍属于受管环境职责。

## 4. 26.901 新版专项适配

| 上游变化 | 本次适配 |
| --- | --- |
| 主程序与共享模块文件名变化 | 锁定新版主进程、RPC 连接模块与命令表，继续进行精确/语义补丁检查 |
| 前端拆分为 app-initial 与 app-primary | 分别处理路由/JSX/首启逻辑和模型推广；不依赖旧版打包文件名 |
| 原生 feature 读写函数变化 | 适配新版读写入口，继续强制关闭企业受限能力 |
| 设置页导入符号变化 | 适配 useLocation、useNavigate 与 Outlet；preview.2 在原四个精简页面之外恢复宠物页 |
| 模型推广组件变化 | 关闭新模型推广与 Fast mode 推广弹窗 |
| Windows 沙箱状态 atom 变化 | 对完整访问默认值返回“不需设置”，避免出现 Finish Windows setup |
| 自定义模型名称增加格式选项 | 没有 displayName 时显示实际模型 ID；已有名称仍正常显示 |
| 云任务调用增加取消检查和独立 target 变量 | 继续在 schema 与执行入口限制云任务，同时保留正常本地线程创建 |
| 归档分页参数变化 | 保留 background 请求选项，归档读取使用状态库，分页失败保留已取得结果；普通线程请求错误不吞掉 |
| 新增统一 Computer Use 插件 | 移除 `unified-computer-use`，并在 CLI 插件覆盖中关闭 |
| 新增桌面应用自动化工具 | 移除 `codex-app-tools`，避免重新开放自动化等高级工具 |
| 新增个性化写作插件 | 移除 `user-writing` |
| MSIX 运行时路径 | 规范化 `%40` 作用域目录及 Statsig 文件名，移除 Computer Use 专用的 cua/sky/browser-desktop 依赖；保留 Node、npm 和普通办公依赖，验证安装目标路径长度 |
| Owl 拆分 Electron 运行时 | 新版完整性 fuse 位于 `chrome.dll`，主 EXE 仅为启动器；更新打包时的 ASAR fuse 处理并验证结果，未知布局直接构建失败，见 [desktop-runtime-fuses.mjs](../scripts/desktop-runtime-fuses.mjs) |
| 侧栏原生菜单直接读取子元素 props | 屏蔽操作使用不渲染任何 DOM、也不携带事件的空组件元素，兼容菜单 cloneElement/Slot 接口，避免 null 子元素导致整个首页错误 |
| 模式/宠物快捷键改名 | 补充 switchToMode1/2、togglePriorityFilter 等受限命令别名；屏蔽 Work/Chat 快捷模式及不留历史的 temporaryChat。preview.2 恢复 openAvatarOverlay 宠物快捷键，保留 Codex、普通聊天和语音快捷键 |
| 权限选择迁移到 permissionProfile | 使用新的 default_permissions 启动覆盖；不与旧 sandbox_mode 同时设置，增加 config/read 有效值及首页 Full access 断言 |
| 权限界面仍保留旧选择逻辑 | rollout 未开启时旧 composer 忽略 CLI 默认权限；调整其新聊天默认选择为 full-access，并先检查服务器 requirements 是否允许，不修改或绕过管理员权限限制 |
| 新增浏览器能力 | 关闭 browserExtensions、browserSettingsCloudSync、browserUseTinysky、inAppBrowserUseHistory、cuaPIP 等 |
| 全功能离线构建主动启用高级功能 | 企业构建使用 `--enterprise`，跳过浏览器/Computer Use、工作环境和 Activity 入口启用逻辑；保留必要的独立启动、办公插件、离线查询、模型和归档兼容 |
| Windows 界面测试使用旧模块导出 | 更新测试入口，并增加语音和受控插件页面检查 |

新版包检查会要求关键离线兼容 marker、企业原生拦截、策略副本一致性、禁止插件缺失、办公插件存在及 JavaScript 语法全部通过。缺少必要补丁时构建失败，不靠删除断言交付。

## 5. 安装与配置生命周期

- 预览应用名称：TEENet AI 工作间；使用独立的预览安装标识和快捷方式。
- 默认安装目录：`%LOCALAPPDATA%\TEENet\CodexPreview`。
- 预览安装器 AppId：`9B209189-3509-4596-B79C-28A83CF2DD09`。
- 启动器：`Codex.vbs` / `Codex.cmd`，运行企业 setup 后启动桌面程序。
- 安装与启动不覆盖员工 Provider、API Key、已有模型配置或会话文件。
- setup 仅负责必要的 Skill 种子及运行环境准备，不承载后台审计、计费或业务兼容规则。
- 安装、重新安装与配置保留逻辑见 [setup-enterprise-preview.ps1](../scripts/setup-enterprise-preview.ps1) 和 [TEENetPreview.iss.tpl](../installer/TEENetPreview.iss.tpl)。
- 本包尚未完成对 `C:\tools\Codex` 的正式覆盖升级验收。单机试用使用默认预览目录；管理员机队升级需另外确认安装目录、旧文件清理、运行用户和快捷方式。

## 6. 管理系统与未完成事项

以下需求不能标记为本次桌面包已完成：

- [ ] 明确并联调管理员默认模型、网关、隐私策略与允许插件名单。
- [ ] 对话按项目归属进入后台数据库；当前 ai-env-mgr 文件回收不等于项目结构化落库。
- [ ] 验证审计/复盘后台实际收到 Codex 模式会话。
- [ ] 在真实企业网关下验证模型请求、语音和办公插件端到端效果。
- [ ] 网关计费与官方 API 校准。
- [ ] 验证 ai-env-mgr 通过 OSS 下载、SHA-256 校验、静默覆盖的正式升级流程。
- [ ] 审批正式发布及员工部署；当前仅生成预览构建产物，不创建正式 Release。

ai-env-mgr 相关代码位于 `/root/pp_home/windows-pc/ai-env-mgr`。本次任务未修改该仓库，也未发布机队策略。

## 7. 验证与交付记录

### preview.2：恢复宠物与删除提示（2026-09-09）

验收代码提交：`9b4e9ad548ac4ec39563291f1dc6bd94402e0b34`；[Windows CI 与日志](https://github.com/TEENet-io/codex-kiosk/actions/runs/34328652505) 全部通过。后续文档提交补充了第 2.1 节完整设置表，不改变该安装包。

- 通过全量回归、网关构建与测试、包完整性验证、真实 CLI 配置读取、静默安装及生产 EXE 启动检查。
- 七个页面截图检查通过；精简偏好页有五个入口，管理员配置提示已删除，其他受限设置仍重定向。
- 宠物快捷键存在；在宠物偏好页点击 Wake Pet 后实际创建 `/avatar-overlay` 窗口，点击 Tuck Away Pet 后恢复未显示状态。
- `rendererErrors=[]`、`consoleErrors=[]`；Provider 与管理员配置保留。真实网关、语音与插件服务的联调边界仍同第 6 节。
- [下载 preview.2 安装器、便携包、block-list 与报告](https://nightly.link/TEENet-io/codex-kiosk/actions/artifacts/10095122653.zip)；[仅下载截图与验证报告](https://nightly.link/TEENet-io/codex-kiosk/actions/artifacts/10095101694.zip)。解压总包后运行 `TEENet-Codex-26.901.51231-enterprise-preview.2-setup.exe`。
- 本机目录：`/root/sun_home/codex-kiosk/dist/enterprise-26.901-preview2/`。

| preview.2 文件 | SHA-256 |
| --- | --- |
| `TEENet-Codex-26.901.51231-enterprise-preview.2-setup.exe` | `d77828ab309ad7993f3b256f1e4bd943db4b10e71dabb004445e1ee362b653c5` |
| `TEENet-Codex-26.901.51231-enterprise-preview.2-portable.zip` | `290cf8865d690e253423b86f1172e8098119098fcc85bda70d393be3cdcfd77c` |

试用反馈：员工机器安装 preview.1 后显示“ChatGPT 遇到了问题”，尚待错误详情定位。上述 CI 使用隔离测试配置，不能据此声称已修复该机器上的启动故障；preview.2 的功能改动也不是针对该故障的修复。

### preview.1 历史验收

最终 Windows 预览验收已通过（2026-09-09）。验收代码提交：`678f45d39ed288614a9aed8d7cc54ca4bf50d213`；[CI 运行与完整日志](https://github.com/TEENet-io/codex-kiosk/actions/runs/34321045595)。以下记录对应 preview.1。preview.2 恢复宠物并删除权限提示，其新包验收结果将在本节单独记录，不能用旧包结果代替。

- Windows：125 项回归测试、18 项网关测试全部通过，网关构建通过。
- 包验证：补丁完整性、JavaScript 语法、企业策略副本、插件名单、运行时路径及 Owl ASAR fuse 检查通过。
- CLI：未配置 node_repl、已有 HTTP MCP、已有 stdio MCP 三种配置均初始化成功；config/read 确认有效默认权限与审批值，原配置文件未修改。
- 安装：静默安装成功，管理员 Provider/模型配置保留，Skill 创建种子存在；分发的生产 EXE 直接启动成功，app-server 与窗口就绪。
- 界面：首页、外观、快捷键、归档、语音、受控插件页共六张截图；首页明确显示 Full access 和配置中的 GPT-5.6，受限设置重定向、Work/Chat/宠物/Activity/临时聊天快捷键检查通过。
- 运行异常：`rendererErrors=[]`、`consoleErrors=[]`；主进程无未捕获异常。
- 测试使用无效的占位凭据，不发送真实模型请求。语音页面明确显示账户无 voice chat 权限；插件页已验证可进入及管理操作限制，截图仍为 Loading plugins，未验收真实插件目录加载、语音通话或网关端到端能力。这些仍按第 6 节联调。
- 截图测试仅对临时安装副本启用 DevTools；分发安装器和 ZIP 保持生产配置。

### 下载与校验

- [安装器、便携包、block-list 与验证报告](https://nightly.link/TEENet-io/codex-kiosk/actions/artifacts/10092114714.zip)（约 1.39 GB，解压后使用根目录的 setup.exe）。
- [单独下载截图与验证报告](https://nightly.link/TEENet-io/codex-kiosk/actions/artifacts/10092089736.zip)。
- GitHub Actions 产物保留 14 天。当前未创建正式 Release，也未发布到 OSS 或员工机队。
- 本机交付目录：`/root/sun_home/codex-kiosk/dist/enterprise-26.901/`。

| 文件 | SHA-256 |
| --- | --- |
| `TEENet-Codex-26.901.51231-enterprise-preview.1-setup.exe` | `1864449608fb9d095a21de8a9eb5a2e8e83249496028ab57c059c022f1ae32b9` |
| `TEENet-Codex-26.901.51231-enterprise-preview.1-portable.zip` | `77256ce27ec403962e51aa5fc37f443b8ec40506c426be62160b1422596001ee` |

随包文件：`block-list.md`、`enterprise-build.json`、`SHA256SUMS.txt`；CI 另提供截图、安装日志、桌面日志和 `smoke-result.json`。安装包摘要与第 1 节的原始 MSIX 摘要不同，不能混用。

### 此次适配的 CI 问题追踪

以下均为中间验证记录，应使用上面的最终通过产物：

| 运行 | 当时的问题 | 已落地修复 |
| --- | --- | --- |
| [34316082790](https://github.com/TEENet-io/codex-kiosk/actions/runs/34316082790) | 安装路径过长，安装器回滚 | 规范化 MSIX 路径，移除 Computer Use 专用深层依赖，检查路径预算 |
| [34316766914](https://github.com/TEENet-io/codex-kiosk/actions/runs/34316766914) | 安装成功，ASAR 完整性校验阻止启动 | 定位 Owl 的 chrome.dll fuse，构建时处理并验证 |
| [34317578874](https://github.com/TEENet-io/codex-kiosk/actions/runs/34317578874) | 生产启动成功，侧栏读取 null 子元素 props | 屏蔽操作保留空组件元素接口，不保留 DOM/事件 |
| [34318409339](https://github.com/TEENet-io/codex-kiosk/actions/runs/34318409339) | 自动检查通过，截图发现快捷键别名与默认权限遗漏 | 补充模式/宠物等新命令别名，适配权限档案并增加明确断言 |
| [34319258116](https://github.com/TEENet-io/codex-kiosk/actions/runs/34319258116) | 冷启动首页尚空白，权限断言过早 | 有限时等待首页与权限数据就绪，失败时记录页面文字 |
| [34320066012](https://github.com/TEENet-io/codex-kiosk/actions/runs/34320066012) | 页面加载后旧权限界面仍默认 Ask for approval | 默认选服务器允许的 full-access，保留 requirements 限制检查 |

下次升级顺序：归档官方包及摘要 → 核对本清单 → 适配补丁和新增功能 → 运行回归 → 构建/验证 → Windows 安装与页面检查 → 更新本清单和 block-list → 再安排正式发布。

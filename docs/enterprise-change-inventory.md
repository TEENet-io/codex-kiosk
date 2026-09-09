# TEENet 企业版 Codex 完整改动清单

本文件记录企业精简版已实现的改动、保留能力、对应代码及尚未完成的集成项。需求依据为 2026-09-08 TEENet 周会；最近更新：2026-09-09。

当前候选：`26.901.51231-b5`，修复偏好页“返回对话”的 Windows 鼠标命中问题，并恢复宠物入口、快捷键、悬浮窗和启动恢复，Windows 构建及中英文安装交互验证完成，下载见第 7 节。此前清理旧 `.codex` 后的启动恢复与本次按钮修复分开记录；沿用 Codex 名称与安装位置。b3 的宠物隔离仅为历史记录，b5 恢复下方功能表中的宠物能力。详见[原生点击对照](enterprise-preview.md#2026-09-09-偏好页返回按钮的原生点击)。尚未通过 ai-env-mgr 发布到员工机队。

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
- 安装、重新安装与配置保留逻辑见 [setup-enterprise-preview.ps1](../scripts/setup-enterprise-preview.ps1) 和 [CodexManaged.iss.tpl](../installer/CodexManaged.iss.tpl)。
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

### Codex 26.901.51231-b5：返回按钮与宠物恢复（2026-09-09）

- 产品提交：`b77f7684b077da0b962fa89e1722651640f5335c`。返回按钮使用 `preferences.js.txt` 中的 `no-drag` 排除 Windows 标题栏拖动命中；`policy.cjs` 恢复宠物路由、命令、菜单和消息；`patch-bundle.mjs` 撤销 b3 对原生窗口恢复、预加载和创建的临时阻断。保留 b2/b4 命令注册修复。
- [构建 34370298624](https://github.com/TEENet-io/codex-kiosk/actions/runs/34370298624) 完成 Windows 回归、网关构建和测试、包验证、安装与英文交互验收。中文原生返回点击首次失败，保留原失败报告，不把该构建标为全部成功。
- [同包复测 34371748817](https://github.com/TEENet-io/codex-kiosk/actions/runs/34371748817) 使用测试提交 `bafef49a3c9052d5af1f9a944b2b40b1f602cced`，确认默认 MainWindowHandle 为 327816（451×768 宠物窗），主界面实际为 262548（870×600）。测试 helper 改为按 CDP 视口尺寸唯一匹配窗口，仍使用 Windows 系统鼠标；没有改动分发程序。
- 复测中文 bearer 场景全部通过：宠物启动恢复、显示/收起、DeepSeek → Kimi → DeepSeek、两次原生返回及继续输入；英文与中文均 `rendererErrors=[]`、`consoleErrors=[]`。两次返回均收到一次点击、离开偏好页并出现输入框，截图已人工查看。配置与已有 Skill 保留。使用合成凭据，未验证真实网关模型请求、语音通话或完整员工历史状态。
- [下载 b5 包](https://nightly.link/TEENet-io/codex-kiosk/actions/artifacts/10112174156.zip)（约 1.39 GB，保留 14 天）；解压运行 `codex-only-local-26.901.51231-b5-setup.exe`。退出 Codex 后安装到当前程序目录，无须清空 `.codex`。没有创建正式 Release 或发布员工机队。
- [构建验收报告](https://nightly.link/TEENet-io/codex-kiosk/actions/artifacts/10112131507.zip)包含英文通过与中文首次失败；[中文复测报告](https://nightly.link/TEENet-io/codex-kiosk/actions/artifacts/10112386850.zip)全部通过，保留 7 天。

| 文件 | SHA-256 |
| --- | --- |
| `codex-only-local-26.901.51231-b5-setup.exe` | `847d9b2c006fe199d136b7209dbf4eb7e6051803091149065b1e1a3bdb5ab4d0` |
| `codex-only-local-26.901.51231-b5-portable.zip` | `f7256f3e3589097e3eedd9b7fd5bd964b60e1fb111de01930d78db33a90425d7` |
| 整个 Actions 下载 ZIP | `d2beda2e44caa382475b1c0435522858ded608cafa70f702079163e136cf2f22` |

### Codex 26.901.51231-b2：模型命令更新循环（2026-09-09）

构建提交：`59ac95f36cc18d06c9bb48d4b70fb47fd49f82f0`；[Windows 构建与验收](https://github.com/TEENet-io/codex-kiosk/actions/runs/34339897422) 全部通过。

- 员工 trace 定位到 React 更新层级上限及命令注册布局 effect。修复在固定版本 `pUr` 组件内缓存模型投影，避免不变列表的对象引用变化引发重复注册。版本、替换锚点和包 marker 均验证；回归 fixture 与固定原始 MSIX 的函数逐字一致。
- 132 项脚本回归、18 项网关测试和网关构建通过；新安装包完整性、原生 CLI、静默安装、旧程序替换与用户配置/Skill 保留通过。
- 新包英文/API Key 与中文/Provider bearer/宠物启动恢复两套页面检查通过，含聚焦输入框输入 `/model`；`rendererErrors=[]`、`consoleErrors=[]`，截图完整。宠物显示和收起保留。
- 额外诊断 34339897643、34339998122 分别覆盖仅 bearer 和过期 ChatGPT 凭据下的中英文宠物恢复，均通过。原始 b1 的隔离界面也未完全复现员工现场，不能以这些合成测试保证其所有持久状态均正常；需员工安装 b2 回测。真实模型请求、语音通话和远程插件服务没有在本次使用占位凭据的检查中执行。
- [补充交互验收 34342443362](https://github.com/TEENet-io/codex-kiosk/actions/runs/34342443362) 使用同一份已交付 b2 安装包，测试脚本提交 `62ac1a92b39a6b3d42eadff622297e7db7fe76ba`。中英文、过期 ChatGPT 凭据、宠物启动恢复两组全部通过：打开可见模型列表，DeepSeek → Kimi → DeepSeek 连续切换，随后验证偏好页与宠物显示/收起；两组 `rendererErrors=[]`、`consoleErrors=[]`。脚本适配新版菜单选中后保留强度弹窗的交互，并只通过调试协议返回可序列化的就绪状态；未修改分发包。[英文报告](https://nightly.link/TEENet-io/codex-kiosk/actions/artifacts/10100408543.zip)、[中文报告](https://nightly.link/TEENet-io/codex-kiosk/actions/artifacts/10100470531.zip)保留 7 天。
- [下载安装器、便携包与报告](https://nightly.link/TEENet-io/codex-kiosk/actions/artifacts/10099713592.zip)（1,386,825,757 字节）；解压后运行 `codex-only-local-26.901.51231-b2-setup.exe`。[仅下载截图与验证报告](https://nightly.link/TEENet-io/codex-kiosk/actions/artifacts/10099679716.zip)。产物保留 14 天，未创建正式 Release。

| b2 文件 | SHA-256 |
| --- | --- |
| `codex-only-local-26.901.51231-b2-setup.exe` | `d8efad18a80efe1a7a02cab58b7ffa38b9ff494618ba9cc1f32c5b0a96de0fbb` |
| `codex-only-local-26.901.51231-b2-portable.zip` | `6d5fa9f0fee453254f6b3eef7e7586a921ebbea7d5b17ba2d300baa3a2b3378d` |
| 整个 Actions 下载 ZIP | `6827c8967f96a22037f2bf38d19040ff797f9b5aa46595e102a9064d18e69d28` |

### Codex 26.901.51231-b3：暂时屏蔽宠物（2026-09-09）

用户确认 b2 仍报错，要求先关闭宠物验证。`policy.cjs` 关闭入口、快捷键、gate 与消息；`patchPinnedPetIsolation` 针对固定原生管理器停止恢复和预加载，并使 `ensureWindow` 返回已支持的 null。保留用户原始宠物状态及 Provider、模型、凭据、会话。本节优先于上方历史功能表中“保留宠物”的描述。

- 构建提交 `b95a90b20ccf8b4c3a75897755e1395cd44c0c34`；[Windows CI 34361590519](https://github.com/TEENet-io/codex-kiosk/actions/runs/34361590519) 全量回归、网关构建、包验证、安装与两套界面验收全部通过。
- 英文普通启动、中文 bearer 且旧宠物状态为 true 均正常；设置仅四个入口、宠物快捷键移除、宠物路由重定向。DevTools 目标和桌面窗口日志均无 avatar，原始开启状态仍保留。中文模型连续切换通过，两组 `rendererErrors=[]`、`consoleErrors=[]`。
- [b3 安装器与便携包](https://nightly.link/TEENet-io/codex-kiosk/actions/artifacts/10108578417.zip)，解压运行 `codex-only-local-26.901.51231-b3-setup.exe`。[截图与验证报告](https://nightly.link/TEENet-io/codex-kiosk/actions/artifacts/10108532431.zip)，本地报告 `/tmp/codex-b3-validation.zip`。产物保留 14 天，未创建 Release。
- 安装器 SHA256：`876c000251d5aaa9053bfd90e5b04f598b1bc33f2378ce20f0b68cbac87d276c`；便携包 SHA256：`b0075df37dcb525e103da253640f3d8a3e75aec8a766f5d6ba3437e9c23322df`；整个 Actions ZIP SHA256：`8f596256cedee344a8947bbee53a910d33ccc9bc5916e70b334f829322f5ff39`。
- 这是关闭宠物后的隔离测试，不是员工现场故障已修复的结论。原生悬浮窗还承载部分语音/快捷浮窗展示，本包不创建该共享窗口；语音偏好页保留，真实语音通话、模型服务请求未执行。

### Codex 26.901.51231-b1：恢复原安装名称（2026-09-09）

构建提交：`c778b1500d179a295d9bbfde5cf6cb999a59186f`；[Windows 构建与验收](https://github.com/TEENet-io/codex-kiosk/actions/runs/34332567479)。

- 安装器与快捷方式统一显示 Codex，默认目录 `%USERPROFILE%\Codex`，沿用旧安装 AppId；以前手动选择过安装目录时优先复用该位置。
- 实际安装后的测试通过：旧运行时哨兵文件被清除，用户配置与已有 Skill 保留；生产 EXE 启动、七页截图、宠物悬浮层显示/收起、完整访问默认值与管理限制正常，`rendererErrors=[]`、`consoleErrors=[]`。
- [下载安装器、便携包与报告](https://nightly.link/TEENet-io/codex-kiosk/actions/artifacts/10096695512.zip)，解压后运行 `codex-only-local-26.901.51231-b1-setup.exe`；[仅下载验证报告](https://nightly.link/TEENet-io/codex-kiosk/actions/artifacts/10096667904.zip)。产物保留 14 天，未创建正式 Release。
- 同日[独立诊断](https://github.com/TEENet-io/codex-kiosk/actions/runs/34332556000)在 preview.2 包上使用员工提供的八个模型元数据，测试 API Key、仅 Provider bearer、残留过期 ChatGPT 凭据及原目录对照，四组通过。未发送真实模型请求，也未复现员工机器的空消息 AppRoutes 异常，不能据此宣称该异常已修复。

| 文件 | SHA-256 |
| --- | --- |
| `codex-only-local-26.901.51231-b1-setup.exe` | `063b68eeeb4cb5842a50e36c9ab54cdc307fb11647686352a7e1ac109669767a` |
| `codex-only-local-26.901.51231-b1-portable.zip` | `60515f2050312bc4652a844323cea8b45077e388295fcbc5dba5d2103b064d0b` |

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

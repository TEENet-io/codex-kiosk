# TEENet 企业版 Codex 完整改动清单

本文件记录企业精简版已实现的改动、保留能力、对应代码及尚未完成的集成项。需求依据为 2026-09-08 TEENet 周会；最近更新：2026-09-09。

适用版本：`26.901.51231-enterprise-preview.1`。这是单机试用预览包，尚未通过 ai-env-mgr 发布到员工机队。

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
| 完整设置 | 屏蔽，改为“外观与快捷键”精简页面 | 只允许外观、语音、快捷键、归档四个设置子路由；默认打开外观 |
| 模型、连接、隐私等管理配置 | 沿用管理员配置，员工不能从客户端改管理项 | 拦截配置写入 RPC；保留模型、推理强度、推理摘要和服务档位的会话模型操作 |
| 账户管理 | 收起登录切换、退出、账户/工作区管理等员工入口 | 不捆绑员工密钥，不跳过必要的认证；管理员仍须下发有效配置与凭据 |
| Worktree / 编码环境 | 隐藏入口、命令、快捷操作及相关原生管理处理器 | 屏蔽创建 Worktree、工作环境保存、远程安装等；普通项目目录和文件能力保留 |
| 连接管理 | 不允许员工新增/授权远程连接 | 屏蔽 SSH、远程控制、WSL 连接管理及 MCP OAuth 登录入口/RPC |
| Computer Use / 浏览器 | 关闭 | 进程环境、桌面 feature、Statsig gate、命令、消息处理、CLI 插件覆盖及插件文件共同限制 |
| 浏览器配置同步 | 禁用 | 阻止扩展同步及浏览器 MCP 自动重写，避免修改管理员已有配置 |
| 个性化 | 隐藏 | 关闭个性化入口、首启问卷、头像悬浮层、侧栏自定义及相关推广 |
| 导入导出 | 隐藏 | 关闭外部 Agent 配置导入、配置编辑、主题导入导出等配置入口；不删除正常聊天生成文件能力 |
| 自动化及高级入口 | 隐藏 | 收起 Scheduled/Heartbeat、PR、Scratchpad、Chronicle、浏览器页、调试等非员工必需入口 |
| 归档聊天 | 保留归档/恢复 | 在精简偏好页提供归档入口；适配本地归档分页与离线错误处理 |
| 快捷键 | 保留普通快捷键与查看页面 | 删除受限功能对应的命令；保留新建对话、模型选择、语音等正常操作 |
| 语音 | 保留 | 保留语音页面与快捷键；隐藏屏幕上下文等高级控制选项；真实语音服务仍需员工环境联调 |
| 外观 | 保留 | 精简页面可访问；配置类的主题导入导出隐藏 |
| 默认权限 | 预设完整访问 | app-server 启动参数设置 `sandbox_mode="danger-full-access"`、`approval_policy="never"`；跳过不适用的 Windows 沙箱安装向导 |
| 对话 / 项目 | 保留本地 Codex 模式 | 保留会话、项目、普通文件与终端能力；限制切换到 Work/Chat 与云任务创建/查询 |
| 模型切换 | 保留 | 默认模型读取现有管理员配置；修复自定义模型名称回退及模型可用性兼容；不擅自替换企业默认模型 |
| 插件页 | 保留但受控 | 员工不能安装/卸载插件、添加市场、分享管理插件；原生启动仅能从可信内置市场安装允许的插件 |
| 办公插件 | 保留管理员预装的办公运行时 | documents、spreadsheets、presentations；既有允许的 latex、deep-research、visualize、sites 策略保留 |
| Skill 创建 | 保留 | 安装时提供 Skill 创建种子，保留对应入口和能力 |
| 会话文件 | 保留原位置 | 沿用 `CODEX_HOME` 或用户 `.codex`，不迁移或删除原有会话 |
| 对话回收 / 项目归属落库 | 待后台联调 | ai-env-mgr 已有文件采集；本次桌面改造未实现项目归属入库、审计后台或网关计费校准 |

企业策略的唯一来源是 [policy.cjs](../scripts/enterprise/policy.cjs)。精简页面见 [preferences.js.txt](../scripts/enterprise/preferences.js.txt)。

## 3. 屏蔽如何落实

| 层次 | 具体改动 | 文件 |
| --- | --- | --- |
| 原生菜单与命令注册 | 从命令表删除受限命令；原生菜单引用已删除命令时返回隐藏菜单项，避免启动报错 | [patch-bundle.mjs](../scripts/enterprise/patch-bundle.mjs)、[runtime.cjs](../scripts/enterprise/runtime.cjs) |
| React 界面 | 在 JSX 创建与国际化标签边界移除受限按钮/菜单/设置字段，保留相邻正常操作 | [policy.cjs](../scripts/enterprise/policy.cjs) |
| 路由 | 设置只开放四个精简页面；编码后的路径、额外子路由及受限页面不能绕过 | 同上 |
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
| 设置页导入符号变化 | 适配 useLocation、useNavigate 与 Outlet，保持四个精简页面可用 |
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

- 本地：新版独立运行补丁全部匹配，企业语义补丁及整包验证通过。
- 本地：相关回归测试 74 项通过、1 项因平台条件跳过；网关构建及 18 项测试通过。
- 新增回归覆盖：静态 gate 的企业关闭值、新模型格式化调用、归档分页/错误语义、新增受限插件、云任务执行入口。
- Windows CI：首次新版构建通过，实际安装遇到 Computer Use 依赖超长路径并回滚。补齐 MSIX 路径规范化与专用控制依赖移除后，第二次静默安装、管理员配置保留及 Skill 初始化通过；生产程序启动又暴露 Owl 运行时 ASAR fuse 定位变化，已增加修复与回归验证，最终 Windows 验收待完成。
- 首次新版验收运行（安装失败，非交付版本）：<https://github.com/TEENet-io/codex-kiosk/actions/runs/34316082790>。
- 第二次新版验收运行（安装成功、启动失败，非交付版本）：<https://github.com/TEENet-io/codex-kiosk/actions/runs/34316766914>。
- 桌面检查：生产程序直接启动、静默安装、管理员配置保留、首页、精简偏好、受限设置重定向、快捷键、归档、语音、受控插件及异常日志。
- 截图测试仅修改临时安装副本以启用 DevTools；分发的安装器和 ZIP 保持生产配置。

随包文件：`block-list.md`、`enterprise-build.json`、`SHA256SUMS.txt`；CI 另提供截图、安装日志、桌面日志和 `smoke-result.json`。安装包 SHA-256 在 Windows 构建完成后记录，不能拿原始 MSIX 的摘要代替。

下次升级顺序：归档官方包及摘要 → 核对本清单 → 适配补丁和新增功能 → 运行回归 → 构建/验证 → Windows 安装与页面检查 → 更新本清单和 block-list → 再安排正式发布。

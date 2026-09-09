# Codex 精简版构建

当前候选 `26.901.51231-b5`：修复偏好页“返回对话”被 Windows 顶部拖动区域截走鼠标点击的问题，并按用户要求恢复宠物入口、快捷键、悬浮窗和启动恢复；保留 b4 命令注册修复。Windows 构建及中英文安装交互验证完成，下载与校验见交付记录。用户此前通过清理旧 `.codex` 恢复启动；不要求再次清理配置。

依据 2026-09-08 周会，企业版保留对话、项目、归档、语音、外观、快捷键、模型切换、管理员预装插件及 Skill 创建，收起设置、编码环境、自主安装和高级控制入口。

完整功能表、代码对应关系、版本适配和待开发事项见 [企业版完整改动清单](enterprise-change-inventory.md)。

## 固定构建输入

当前构建 `26.901.51231-b5` 基于官方 Windows x64 MSIX `26.901.6511.0`，SHA-256 为 `fd9ae9eeeeaf11577191ce5a39d0b8f95fa73d591aa3a94f688b84d294d1fa85`。版本、来源与摘要固定在 `config/enterprise-preview.json`。验证结果和员工实际状态的回测边界见[交付记录](enterprise-change-inventory.md#7-验证与交付记录)。官方稳定下载地址会滚动更新；若摘要不符，构建立刻失败，必须提供保存的固定版本 MSIX，不能自动接受新包。

`carrier` 仍使用已发布的 `offline-v26.810.52044-b1`，仅提供启动器、模型目录、Skill 种子和固定办公插件。构建删除载体的整套 `_internal/app`，换入官方新版 app（包括 EXE、CLI、原生模块和前端），再执行独立运行补丁与企业策略。原生组件不会与旧版混装。

```sh
npm ci
node scripts/build-enterprise-preview.mjs --source-msix /path/to/ChatGPT-26.901.6511.0-x64.msix --output dist/enterprise-current
# Windows 上额外传 --installer 生成安装器，然后运行桌面验收
node scripts/smoke-enterprise-preview.mjs dist/enterprise-current/codex-only-local-26.901.51231-b5 dist/enterprise-current/smoke
```

新版适配保留原企业功能清单，并额外禁用上游新增的统一 Computer Use 插件、自动化应用工具插件、写作个性化插件及浏览器扩展/同步开关。`--enterprise` 不执行浏览器、Computer Use、工作环境和 Activity 入口的启用补丁；静态 gate 替换与运行时统一遵循企业策略。

版本相关变化包括主进程菜单/消息边界、拆分后的主前端与首启推广组件、设置页路由导入、带格式选项的自定义模型名称、新的云任务调用形态和归档分页。新增测试覆盖这些行为；Windows CI 在实际安装后的副本上进行页面检查，分发包保持生产配置。

企业策略与原有全功能版本分开维护；仅本构建加载精简策略。安装程序恢复 Codex 名称、原安装器 AppId 与 `%USERPROFILE%\Codex` 默认目录，并优先沿用已有安装位置。升级清理 `_internal/app` 等程序自有目录，保留用户 `CODEX_HOME`、模型与凭据；以前的独立 Preview 安装需单独卸载。不通过现有机队发布接口自动部署。

## 与已有管理系统的边界

`/root/pp_home/windows-pc/ai-env-mgr` 已负责员工凭据、配置下发、版本分发和会话收集。客户端沿用管理员下发的 `CODEX_HOME` / 用户 `.codex`，不把个人密钥编进包，也不覆盖已有 Provider。

具体默认模型、隐私策略、允许的插件名单须由管理员配置；预览不擅自替换已有网关和模型。项目归属采集需要与管理系统联调，不能以客户端存在项目 UI 代替落库验收。

隐藏配置入口及限制应用内管理操作不等于操作系统级防篡改：会议要求保留完整访问和 Skill 创建，因此操作系统权限、程序执行及管理员配置文件保护仍需由受管终端策略落实。

## 历史依据

### 2026-09-09 偏好页返回按钮的原生点击

用户恢复启动后报告左上角“返回对话”无效。该按钮属于自定义 `preferences.js.txt`，位于顶部 Electron 拖动区域。原测试通过宿主路由消息进入偏好，随后用 DOM click 切换设置，没有实际点击返回按钮，遗漏了 Windows 原生命中测试。

[原生鼠标对照 34368987734](https://github.com/TEENet-io/codex-kiosk/actions/runs/34368987734) 使用已验证 b4 安装包和测试提交 `119065d98a80aee6e27fd4d06f042844adb0a5fb`，通过 `ClientToScreen`、`SetCursorPos` 和 Windows 鼠标输入，在同一屏幕位置点击：原按钮计算样式 app-region 为 none，click 监听未触发，仍在偏好页；临时将按钮设为 no-drag、抬高 header 后，事件到达并返回可编辑对话。原来的 DOM 命中目标已是按钮，说明不需要更改导航地址；b5 最小修改只在按钮使用上游已有 `no-drag` 类。新包验证不注入临时修复样式，直接检查包内样式和两次原生点击，其中一次通过原生 show-settings 重新加载进入。

[对照报告 10111314397](https://nightly.link/TEENet-io/codex-kiosk/actions/artifacts/10111314397.zip) 的 returnButtonBefore/After 保存坐标、计算样式及返回结果。after.clicked 为 2 是前后诊断在同一按钮上各装了一个监听器，不能理解为系统执行了两次点击。改动位于自有偏好页组件，未改上游路由或安装配置生命周期。

### 2026-09-09 员工清理旧状态后恢复

用户明确反馈：清空 `.codex` 后仅放回 config、model 和 auth，程序恢复正常。该结果支持旧目录其他持久状态参与触发故障，但没有逐项隔离，不能确定是全局状态、数据库、插件状态还是其他缓存，也不能保证某一种清理对其他机器有效。清理发生在用户机器，未由本次脚本执行；没有取得被清理文件的副本。

b4 候选提交 `088de5b1e6dfdf00d43c854e40fae0436c2eb368` 的 [Windows CI 34367229919](https://github.com/TEENet-io/codex-kiosk/actions/runs/34367229919) 全部通过，包含安装与中英文输入框/模型切换检查；这属于独立回归，不是现场恢复依据。已撤回尚未提交的诊断工作流 b4 切换，不再启动额外测试或要求现场升级。[验证报告](https://nightly.link/TEENet-io/codex-kiosk/actions/artifacts/10110853315.zip) 中两组 rendererErrors 和 consoleErrors 均为空；中文外观截图仍是加载中，不能将该截图当作外观内容完全就绪的证据，其他偏好导航和模型往返操作已通过。安装器 SHA-256：`780b0d6103dc16b4e5e3c4e4e9d56f599b4e449f8c8ae31c3635b069754f5286`。

### 2026-09-09 b3 后续 trace 与注册器无变化更新

员工 14:50Z 的 trace 只有主窗口，仍出现 `ste → Pzt → Pas/Ras` 链；后续 `DetermineComponentFrameRoot` 下的 `pUr` 不能确认实际触发命令的归属。旧回归的设置对象与选择回调均固定，遗漏了禁用命令依赖换引用的场景。新增回归使用相同版本的真实 hooks，即使应用 b2 模型缓存，禁用命令搭配每次新建的设置/回调仍超过更新上限。

`patchPinnedCommandRegistration` 固定 26.901 两处唯一锚点：注册列表经过原有过滤与排序后，若长度、顺序和各命令对象引用与之前完全相同，返回原数组；清理未移除命令时也返回原数组。没有深比较或忽略回调，启用命令替换仍可通知订阅者。此处是本地 React effect/store 语义，无法由 Gateway 修正。测试覆盖旧补丁仍循环、新补丁停止、模型刷新、单独替换选择回调、禁用/重新启用及卸载。

用户同时报告重试后无法点击。旧采集器会暂停所有异常，最新 trace 中 React 诊断帧相隔约三秒；采集器可能加剧卡顿，但尚不能证明它是全部原因。新版临时采集器捕获固定位置的 React #185 后立即 detach，其他异常最多 64 次，保留 120 秒超时。不读取或写入异常 payload、凭据或作用域。测试确认停止后不再处理异常，销毁时不会重复 detach。日常验证应退出采集器后从正常 Codex 入口启动。

### 2026-09-09 按员工配置对照 b3

用户确认 b3 仍报错，且 `.codex/auth.json` 的 `auth_mode` 为 `chatgpt`。原验收虽然在 Windows 虚拟机实际安装和操作应用，但使用隔离配置：Provider 为 preview、地址为本地无服务端口、阻断外网，生产 bootstrap 使用独立空 home；不能当作用户环境的精确复现。

测试提交 `38ef3233c28f2fe5839150163909decc5fcd8d77` 增加 `employee-config.mjs`，按用户粘贴内容保留 gateway、真实 base_url、live web search、7200000 超时、followUpQueueMode、带扩展前缀的 marketplace source 和 visualize 开关；仅替换机器 home 路径及使用脱敏占位密钥。生产启动与 UI 检查共享同一 home，取消测试的断网代理。实际运行 b3 原安装器，UI 检查仅在临时副本开启 DevTools，仍使用软件渲染和隔离 Electron 状态。模型目录是合成字段，未包含用户全部原始模板；ChatGPT token 也是合成过期凭据，不能宣称完全相同。

[CI 34364921508](https://github.com/TEENet-io/codex-kiosk/actions/runs/34364921508) 两组（无 auth.json、过期 chatgpt auth.json）均未通过完整验收：主界面、偏好、中文模型往返切换正常，`rendererErrors=[]`、`consoleErrors=[]`，但内置市场报 `marketplace 'openai-bundled' is already added from a different source`，市场初始化断言失败。报告中的 `reconcile_completed` 不能盖过此前的 `marketplace_add_failed`，因此保留失败断言。现场源路径差异涉及扩展前缀与 Windows 长短路径，尚未确定各因素贡献；此故障未造成测试中的 AppRoutes 崩溃，不作为用户启动故障的根因结论。

[带 ChatGPT 状态报告](https://nightly.link/TEENet-io/codex-kiosk/actions/artifacts/10109707675.zip)、[无登录状态报告](https://nightly.link/TEENet-io/codex-kiosk/actions/artifacts/10109673812.zip) 含实际脱敏配置和截图，保留 7 天；本地已核查 `/tmp/codex-employee-chatgpt.zip`。后续需要用户 b3 的新 trace 及原始模型目录来对齐剩余状态，不要求真实 API Key 或 token。

### 2026-09-09 命令注册更新循环

员工 trace 的首个非预期同步异常为 `ste`（initial bundle 11:27594，React #185），经 `Pzt` 聚合后从 `Pas` 的 store setter（8235:706814）和 `Ras` 的布局 effect（8235:708387）传播。后续 `DetermineComponentFrameRoot` 调用 `pUr` 时产生的 invalid-hook 异常是组件堆栈重建，不是最早的抛错点；Router 的 `Gw` 也会主动抛出并捕获警告异常。

`pUr` 每次渲染通过 `JIr` 创建新的模型投影数组，并把该数组放进命令注册的 effect 依赖。活动输入框订阅命令更新时可形成「渲染 → 注册 → store 通知 → 渲染」循环。此行为位于桌面 React 状态管理，Gateway 响应处理无法稳定 React 对象引用，因此修复位于版本锁定的 `patchPinnedModelCommand`：仅扩展三个组件 memo 槽，按模型数组及访问模式缓存投影，不改命令注册、选择回调或异常处理。

`composer-registration.test.cjs` 执行保存在 fixture 的实际 `pUr`、`Pas`、`Las` 和 `Ras`，以 store 订阅驱动重渲染；原代码在启用/禁用模型命令两种情况下均超过更新上限，修复后只注册一次，并验证目录刷新、选择回调与卸载。包验证器必须检查新增 marker。Windows 检查新增聚焦输入框并输入 `/model`，不发送模型请求。宠物恢复测试 34338501500 的中英文场景均已通过，但尚不能代替用户实际状态的故障验证。

未修复的 b1 在 34339379263 的中英文 `/model` 检查也没有产生 renderer 异常；原始 Windows 状态仍未完全复现。英文任务最终失败于过宽的市场断言：允许的 `openai-bundled` 已初始化，随后自动下载的 `openai-primary-runtime` 市场被既有策略拒绝。断言改为明确检查允许市场的成功/失败，不放开其他市场、不吞掉其策略拒绝日志。

### 2026-09-09 员工启动诊断

新日志中的实际路径为 `C:\Users\weipeng\Codex`，CLI 0.153.4 握手、配置读取与模型列表读取成功，但 AppRoutes 在 `app-primary-428a0a65766f.js` 的 `pUr` 重复报空消息 Error。移除旧 notify 配置后仍复现，不能以删除旧 Tools 目录或重新登录作为已确认的解决方案。

诊断运行 34336132749 的英文空配置/已有项目两项通过。运行 34336786262 的 `project-zh` 首页文本和截图确认中文、已有项目、DeepSeek V3.2 和完全访问均已渲染，无 renderer error；测试失败来自断言未覆盖「新对话」「完全访问」两个真实译文，已修正测试匹配。该证据只覆盖合成配置，不能推断员工完整状态正常。

`scripts/diagnostics/Trace-CodexStartup.cmd` 为针对 26.901 的临时采集入口：默认定位 `%USERPROFILE%\Codex`，要求先退出已有进程，备份启动注入文件后加入本地 debugger 监听。等待界面打开 15 秒后点击重试，监听最长持续 120 秒，程序退出后恢复文件原始字节。报告不保存异常消息、变量、RPC 内容或凭据，不打开远程调试端口。初版过早开启监听使测试首页空白，调整为加载后延迟开启；不将这个诊断工具自身的问题等同于员工的 AppRoutes 异常。

采集器提交 `8843acb` 的 Windows 验证 [34337667542](https://github.com/TEENet-io/codex-kiosk/actions/runs/34337667542) 全部通过：生产配置禁用 DevTools 时成功附加、捕获已捕获的测试异常并继续执行，实际安装后的首页/偏好页/宠物交互通过，启动器正常及缺少报告两条路径均恢复原始文件与父进程环境。采集器 ZIP [10098385181](https://nightly.link/TEENet-io/codex-kiosk/actions/artifacts/10098385181.zip)，大小 4059 字节，SHA-256 `3855c187f4827fe3cf78fe2ba060b0624ecc076680e3dc0f3ec1e944830ef2ec`。它是诊断工具，不是修复安装包。

员工后续观察到宠物加载时出现错误。源码确认启动恢复读取 `.codex-global-state.json` 的 `electron-avatar-overlay-open`，独立于 `config.toml`；新增 `pet-en` / `pet-zh` 场景预置该开关，区分启动时自动恢复和首页稳定后的手动显示。

另一个独立问题发生在原生 bundled 插件同步：它需要清理已移除的 `browser@openai-bundled`，却被员工卸载限制阻止。共享策略仅对原生请求、明确移除的 bundled 插件 ID 放行；renderer 请求和自定义插件仍拒绝。目标回归通过，尚未作为新安装包交付，也没有将其认定为 `pUr` 根因。

- Claude 2026-08-14 至 08-16：适配 `26.810`、关闭 Web 打包、修复补丁与验证器漂移，构建使用 GitHub Windows runner。
- Codex 2026-08-23：将每日版本探测与完整构建拆开，添加固定 URL、版本及 SHA-256 的 archive 源；没有取得可归档的历史 MSIX，因而默认源仍为动态源。
- Codex 2026-09-06：确认客户端、`ai-env-mgr` 管理系统与 LiteLLM 网关的职责划分。

以上是本机历史会话中记录的结论。本次打包必须独立验证，不能用过去通过的结果充当本次企业版验收。

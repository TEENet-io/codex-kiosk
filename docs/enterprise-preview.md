# TEENet 企业版预览

依据 2026-09-08 周会，企业版保留对话、项目、归档、语音、外观、快捷键、模型切换、管理员预装插件及 Skill 创建，收起设置、编码环境、自主安装和高级控制入口。

## 固定构建输入

当前预览 `26.901.51231-enterprise-preview.1` 基于官方 Windows x64 MSIX `26.901.6511.0`，SHA-256 为 `fd9ae9eeeeaf11577191ce5a39d0b8f95fa73d591aa3a94f688b84d294d1fa85`。版本、来源与摘要固定在 `config/enterprise-preview.json`。官方稳定下载地址会滚动更新；若摘要不符，构建立刻失败，必须提供保存的固定版本 MSIX，不能自动接受新包。

`carrier` 仍使用已发布的 `offline-v26.810.52044-b1`，仅提供启动器、模型目录、Skill 种子和固定办公插件。构建删除载体的整套 `_internal/app`，换入官方新版 app（包括 EXE、CLI、原生模块和前端），再执行独立运行补丁与企业策略。原生组件不会与旧版混装。

```sh
npm ci
node scripts/build-enterprise-preview.mjs --source-msix /path/to/ChatGPT-26.901.6511.0-x64.msix --output dist/enterprise-current
# Windows 上额外传 --installer 生成安装器，然后运行桌面验收
node scripts/smoke-enterprise-preview.mjs dist/enterprise-current/TEENet-Codex-26.901.51231-enterprise-preview.1 dist/enterprise-current/smoke
```

新版适配保留原企业功能清单，并额外禁用上游新增的统一 Computer Use 插件、自动化应用工具插件、写作个性化插件及浏览器扩展/同步开关。`--enterprise` 不执行浏览器、Computer Use、工作环境和 Activity 入口的启用补丁；静态 gate 替换与运行时统一遵循企业策略。

版本相关变化包括主进程菜单/消息边界、拆分后的主前端与首启推广组件、设置页路由导入、带格式选项的自定义模型名称、新的云任务调用形态和归档分页。新增测试覆盖这些行为；Windows CI 在实际安装后的副本上进行页面检查，分发包保持生产配置。

企业策略与原有全功能版本分开维护；仅企业版构建加载企业策略。预览包使用独立安装目录和快捷方式，不通过现有机队发布接口自动部署。

## 与已有管理系统的边界

`/root/pp_home/windows-pc/ai-env-mgr` 已负责员工凭据、配置下发、版本分发和会话收集。客户端沿用管理员下发的 `CODEX_HOME` / 用户 `.codex`，不把个人密钥编进包，也不覆盖已有 Provider。

具体默认模型、隐私策略、允许的插件名单须由管理员配置；预览不擅自替换已有网关和模型。项目归属采集需要与管理系统联调，不能以客户端存在项目 UI 代替落库验收。

隐藏配置入口及限制应用内管理操作不等于操作系统级防篡改：会议要求保留完整访问和 Skill 创建，因此操作系统权限、程序执行及管理员配置文件保护仍需由受管终端策略落实。

## 历史依据

- Claude 2026-08-14 至 08-16：适配 `26.810`、关闭 Web 打包、修复补丁与验证器漂移，构建使用 GitHub Windows runner。
- Codex 2026-08-23：将每日版本探测与完整构建拆开，添加固定 URL、版本及 SHA-256 的 archive 源；没有取得可归档的历史 MSIX，因而默认源仍为动态源。
- Codex 2026-09-06：确认客户端、`ai-env-mgr` 管理系统与 LiteLLM 网关的职责划分。

以上是本机历史会话中记录的结论。本次打包必须独立验证，不能用过去通过的结果充当本次企业版验收。

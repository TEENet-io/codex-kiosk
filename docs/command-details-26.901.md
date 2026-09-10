# 26.901 命令详情展开

用户反馈“运行了命令”点击后没有响应。固定上游版本 `26.901.51231` 的 `subagent-activity-chip-group-7235ecadfc3f.js` 中，`YT` 在简化工具活动与 `STEPS_PROSE` 同时启用时传入 `hideRawCommand=true`。`rx` 据此取消 disclosure 回调，并强制详情不可见。此路径已通过原始组件模拟复现；尚未确认用户 Windows 会话的实际模式值。

企业策略屏蔽了模式切换命令，但查看已执行命令不应要求切换整个工作模式。修复位于桌面渲染层，Gateway 返回数据不能恢复一个没有注册的点击操作。

`scripts/enterprise/patch-bundle.mjs` 的 `patchPinnedExecDetails` 只修改该版本 `rx` 的两个表达式：展开状态只取决于组件状态，disclosure 始终保留。`hideRawCommand` 仍控制标题是否包含原始命令；保持默认收起，点击后才渲染现有命令、工作目录、输出、退出状态和审批审查信息。模式、模型请求、权限与用户配置均不变。

补丁使用 AST 限定顶层组件和固定版本，再精确替换唯一表达式。未知版本、语法错误、锚点变化、重复应用均失败。完整包验证器调用同一验证函数，拒绝遗漏补丁或只放入 marker 的包。

验证：

- fixture 从固定版本原始 `rx` 逐字提取；本地与上游完整 bundle 对照。
- 原组件在简化模式下无回调、无详情；补丁后两种显示模式均能展开、收起并显示更新后的输出。
- 完整固定版本 bundle 语法与补丁验证通过，逆向还原两处表达式后与原文件完全一致。
- Windows 构建 [34457431038](https://github.com/TEENet-io/codex-kiosk/actions/runs/34457431038) 生成 b7 安装器与便携包，包和内置 CLI 验证通过。
- 英文、中文 bearer 配置两组安装后验收均通过；使用安装后的真实 `rx` 组件，在应用 providers 内挂载固定命令数据，以 Windows 原生鼠标验证简化与命令模式的展开和收起。截图确认中文“已运行命令”展开后显示命令、输出与成功状态。测试挂载仅存在于临时安装副本，不在分发包中。
- 两组同时通过配置保留、请求批准/完全访问往返、本地项目、返回对话、宠物点击/拖动/后方桌面穿透检查，renderer 与 console 错误均为空。
- 本次没有通过真实模型生成命令，也没有复现用户旧会话的全部状态，现场仍需用户确认。现有 b6 发布资产不包含此改动。

交付：用户授权后，已通过[发布流程 34459335056](https://github.com/TEENet-io/codex-kiosk/actions/runs/34459335056)原样发布为 [Codex b7](https://github.com/TEENet-io/codex-kiosk/releases/tag/offline-v26.901.51231-b7)，设为 Latest、非预发布。GitHub 发布附件摘要与下列验收摘要一致；已安装同一 b7 测试包无需重装。

首次创建发布时指定源码提交返回 403；推送并核对既有标签后改用 `--verify-tag` 创建草稿成功。草稿按标签读取返回 404，改为按 Release ID 核对已上传附件后正式发布成功。没有替换验收资产。

| 文件 | SHA256 |
| --- | --- |
| `codex-only-local-26.901.51231-b7-setup.exe` | `3be9ed4d6ed85ef2155632b47e78a0a8f5244d21434be13712583de8c9210aec` |
| `codex-only-local-26.901.51231-b7-portable.zip` | `2bd461c777591cc64fcf6d45fb391a51b72c712d30d300176c6852d6f7e5c4e4` |

构建源码为 `6d7da25ba2ab251ee4b77cc5f2592d1f6dc3e78a`。本次在已发布 b6 便携包上追加固定版本的两处 UI 补丁，构建脚本验证源 ZIP 的 SHA256 和 ASAR 元数据，并保留来源记录；完整源构建流程也已包含同一补丁。

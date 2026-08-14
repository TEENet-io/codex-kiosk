# 构建环境与发布流程

## 1. 支持环境

完整桌面安装包必须在 Windows x64 上构建。

推荐环境：

| 组件 | 推荐版本 | 用途 |
|---|---:|---|
| Windows | Windows 11 x64 | 解包、补丁、桌面测试和 Inno Setup |
| PowerShell | 7.4 或更新版本 | 主构建脚本 |
| Node.js | 24 LTS | JavaScript 工具、测试和 Web Gateway |
| npm | 随 Node.js 安装 | 根目录依赖 |
| Inno Setup | 6.7 或更新版本 | 生成 `setup.exe` |
| Git | 2.45 或更新版本 | 源码管理 |

不建议在 Linux 上构建 Windows 桌面安装包。Linux 可以开发和测试 Web Gateway，但 Store 包处理、Windows Electron 启动测试和 Inno Setup 仍应放在 Windows runner 上。

## 2. Windows 环境准备

使用管理员 PowerShell 安装工具：

```powershell
winget install --id Git.Git -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Microsoft.PowerShell -e
winget install --id JRSoftware.InnoSetup -e
```

重新打开 PowerShell 7 后确认：

```powershell
git --version
node --version
npm --version
pwsh --version
& "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe" /?
```

构建包含很深的 `node_modules` 路径。建议以管理员身份启用 Windows 长路径：

```powershell
New-ItemProperty `
  -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' `
  -Name LongPathsEnabled `
  -Value 1 `
  -PropertyType DWord `
  -Force

git config --global core.longpaths true
```

## 3. 获取源码

```powershell
git clone <你的仓库地址>
Set-Location <仓库目录>
npm ci
```

仓库不提交以下内容：

- Microsoft Store 下载包；
- 解包后的 Electron 应用；
- PowerShell 或 Node.js 便携运行时；
- `node_modules`；
- `build/`、`dist/`；
- Inno Setup 中间文件；
- Web Gateway 构建缓存。

这些内容由构建脚本按配置下载或生成。

## 4. 运行测试

```powershell
npm test
```

单独执行语法检查：

```powershell
node --check .\scripts\patch-app-asar.mjs
node --check .\scripts\offline-direct-launch-smoke.mjs

$tokens = $null
$errors = $null
[System.Management.Automation.Language.Parser]::ParseFile(
  (Resolve-Path .\scripts\build-offline-package.ps1),
  [ref]$tokens,
  [ref]$errors
) | Out-Null
$errors
```

## 5. 本地完整构建

普通方式：

```powershell
pwsh -NoProfile -File .\scripts\build-offline-package.ps1 `
  -ConfigPath .\config\codex-only-local.json `
  -RequireInstaller
```

Windows 长路径环境下，推荐给工作缓存指定短目录：

```powershell
pwsh -NoProfile -File .\scripts\build-offline-package.ps1 `
  -ConfigPath .\config\codex-only-local.json `
  -RequireInstaller `
  -WorkRoot C:\cb
```

`C:\cb` 只存放可删除的下载、解包和 staging 缓存。正式产物仍写入：

```text
dist/codex-only-local/<版本>/
```

如果不需要安装器：

```powershell
pwsh -NoProfile -File .\scripts\build-offline-package.ps1 `
  -ConfigPath .\config\codex-only-local.json `
  -SkipInstaller `
  -WorkRoot C:\cb
```

## 6. 完整验证

构建结束后找到生成的 `build-metadata.json`：

```powershell
$metadata = Get-ChildItem .\dist\codex-only-local -Filter build-metadata.json -Recurse |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

pwsh -NoProfile -File .\scripts\verify-offline-package.ps1 `
  -BuildMetadataPath $metadata.FullName `
  -ConfigPath .\config\codex-only-local.json `
  -RequireInstallerAsset
```

验证器会使用临时用户数据目录运行桌面程序，不会读取或修改日常 Codex 会话。

## 7. GitHub Actions

仓库包含：

```text
.github/workflows/build-offline-package.yml
.github/workflows/build-offline-package-monitor.yml
```

主工作流支持：

- push 到 `main`；
- pull request 验证；
- 每日定时检查上游版本；
- `workflow_dispatch` 手动构建；
- 自动创建或更新 GitHub Release；
- 上传安装器、便携包、Web 包、技能包、校验文件和构建元数据。

首次 Fork 后：

1. 在仓库 Settings → Actions → General 中允许 Actions 运行。
2. 将 Workflow permissions 设置为 Read and write permissions。
3. 打开 Actions → `build-offline-package` → Run workflow。
4. PR 构建只验证，不发布 Release。

完整构建使用 `windows-latest`。如果 GitHub 托管 runner 太慢，可以部署 Windows Server ECS，并给 self-hosted runner 添加标签，然后将工作流中的：

```yaml
runs-on: windows-latest
```

改为：

```yaml
runs-on: [self-hosted, Windows, X64, codex-builder]
```

自托管 runner 必须预装 PowerShell 7、Node.js 24、Git 和 Inno Setup，并为工作目录保留至少 35 GB 可用空间。

## 8. 发布前人工验收

建议在干净 Windows 虚拟机中检查：

1. 安装过程不显示多余 CMD；
2. 桌面图标和开始菜单图标正常；
3. 启动固定进入 Codex；
4. 无法切换到 ChatGPT；
5. 新建本地任务、执行命令和修改文件正常；
6. MCP、技能和需要的插件正常；
7. 重启应用后限制仍然有效；
8. 卸载后程序文件和快捷方式被清理；
9. 用户的 `~/.codex` 配置和会话按预期保留。

## 9. 清理本地构建缓存

确认没有构建进程运行后，可以删除：

```powershell
Remove-Item -LiteralPath .\build -Recurse -Force
Remove-Item -LiteralPath .\dist -Recurse -Force
Remove-Item -LiteralPath C:\cb -Recurse -Force
```

重新运行 `npm ci` 可以恢复 `node_modules`。


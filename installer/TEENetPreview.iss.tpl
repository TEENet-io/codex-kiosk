#define SourceRoot "__SOURCE_ROOT__"
#define OutputRoot "__OUTPUT_ROOT__"
#define AppVersion "__APP_VERSION__"

[Setup]
AppId={{9B209189-3509-4596-B79C-28A83CF2DD09}
AppName=TEENet AI 工作间预览
AppVersion={#AppVersion}
VersionInfoVersion=__VERSION_INFO_VERSION__
AppPublisher=TEENet
DefaultDirName={localappdata}\TEENet\CodexPreview
DefaultGroupName=TEENet AI 工作间预览
OutputDir={#OutputRoot}
OutputBaseFilename=TEENet-Codex-{#AppVersion}-setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
DisableProgramGroupPage=yes
SetupIconFile={#SourceRoot}\_internal\app\resources\icon-chatgpt.ico
UninstallDisplayIcon={app}\_internal\app\ChatGPT.exe
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
UsePreviousAppDir=yes

[Languages]
Name: "zh"; MessagesFile: "__INSTALLER_ROOT__\ChineseSimplified.isl"
Name: "en"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "{#SourceRoot}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\TEENet AI 工作间预览"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\Codex.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\_internal\app\ChatGPT.exe"
Name: "{autodesktop}\TEENet AI 工作间预览"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\Codex.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\_internal\app\ChatGPT.exe"

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\_internal\setup-enterprise-preview.ps1"""; Flags: runhidden waituntilterminated
Filename: "{sys}\wscript.exe"; Parameters: """{app}\Codex.vbs"""; WorkingDir: "{app}"; Description: "启动 TEENet AI 工作间预览"; Flags: nowait postinstall skipifsilent

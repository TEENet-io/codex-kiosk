#define SourceRoot "__SOURCE_ROOT__"
#define OutputRoot "__OUTPUT_ROOT__"
#define AppVersion "__APP_VERSION__"

[Setup]
AppId={{A68E32B0-4AA6-4B16-9364-B668731F7062}
AppName=Codex
AppVersion={#AppVersion}
VersionInfoVersion=__VERSION_INFO_VERSION__
DefaultDirName={%USERPROFILE|{localappdata}}\Codex
DefaultGroupName=Codex
OutputDir={#OutputRoot}
OutputBaseFilename=codex-only-local-{#AppVersion}-setup
Compression=lzma2/fast
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

[InstallDelete]
; Program-owned files only. CODEX_HOME and user data are outside these paths.
; Reusing the old Codex AppId must not mix an 8xx runtime with the new ASAR.
Type: filesandordirs; Name: "{app}\_internal\app"
Type: filesandordirs; Name: "{app}\_internal\patches"
Type: filesandordirs; Name: "{app}\_internal\chrome-extension"
Type: filesandordirs; Name: "{app}\_internal\tools"
Type: files; Name: "{app}\_internal\setup-codex-offline.ps1"
Type: files; Name: "{app}\Setup Codex.cmd"

[Icons]
Name: "{group}\Codex"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\Codex.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\_internal\app\ChatGPT.exe"
Name: "{autodesktop}\Codex"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\Codex.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\_internal\app\ChatGPT.exe"

[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\_internal\setup-codex-managed.ps1"""; Flags: runhidden waituntilterminated
Filename: "{sys}\wscript.exe"; Parameters: """{app}\Codex.vbs"""; WorkingDir: "{app}"; Description: "启动 Codex"; Flags: nowait postinstall skipifsilent

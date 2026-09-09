param(
    [Parameter(Mandatory=$true)][int]$TargetProcessId,
    [Parameter(Mandatory=$true)][int]$ClientX,
    [Parameter(Mandatory=$true)][int]$ClientY
)
$ErrorActionPreference = 'Stop'
# Exercise Windows hit testing (including Electron draggable regions), which
# DOM click() and DevTools mouse dispatch do not test.
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class CodexNativeClick {
    [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hwnd, ref POINT point);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
}
'@
[CodexNativeClick]::SetProcessDPIAware() | Out-Null
$target = Get-Process -Id $TargetProcessId
$handle = $target.MainWindowHandle
if ($handle -eq [IntPtr]::Zero) { throw 'Target application has no main window.' }
[CodexNativeClick]::SetForegroundWindow($handle) | Out-Null
Start-Sleep -Milliseconds 200
if ([CodexNativeClick]::GetForegroundWindow() -ne $handle) { throw 'Target application did not receive foreground focus.' }
$point = New-Object CodexNativeClick+POINT
$point.X = $ClientX
$point.Y = $ClientY
if (-not [CodexNativeClick]::ClientToScreen($handle, [ref]$point)) { throw 'ClientToScreen failed.' }
if (-not [CodexNativeClick]::SetCursorPos($point.X, $point.Y)) { throw 'SetCursorPos failed.' }
[CodexNativeClick]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 80
[CodexNativeClick]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
@{ processId=$TargetProcessId; screenX=$point.X; screenY=$point.Y } | ConvertTo-Json -Compress

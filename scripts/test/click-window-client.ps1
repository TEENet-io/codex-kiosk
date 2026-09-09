param(
    [Parameter(Mandatory=$true)][int]$TargetProcessId,
    [Parameter(Mandatory=$true)][int]$ClientX,
    [Parameter(Mandatory=$true)][int]$ClientY,
    [Parameter(Mandatory=$true)][int]$ClientWidth,
    [Parameter(Mandatory=$true)][int]$ClientHeight
)
$ErrorActionPreference = 'Stop'
# Exercise Windows hit testing (including Electron draggable regions), which
# DOM click() and DevTools mouse dispatch do not test.
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class CodexNativeClick {
    [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
    public delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr data);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr data);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hwnd, out RECT rect);
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
# An open pet is another visible top-level window in the same process.
# Match the CDP target's viewport instead of .NET's first visible window.
$candidates = [System.Collections.Generic.List[object]]::new()
$callback = [CodexNativeClick+EnumWindowsProc] {
    param([IntPtr]$hwnd, [IntPtr]$data)
    [uint32]$ownerId = 0
    [CodexNativeClick]::GetWindowThreadProcessId($hwnd, [ref]$ownerId) | Out-Null
    if ($ownerId -eq $TargetProcessId -and [CodexNativeClick]::IsWindowVisible($hwnd)) {
        $rect = New-Object CodexNativeClick+RECT
        if ([CodexNativeClick]::GetClientRect($hwnd, [ref]$rect)) {
            $candidates.Add(@{ handle=$hwnd.ToInt64(); width=$rect.Right; height=$rect.Bottom })
        }
    }
    return $true
}
[CodexNativeClick]::EnumWindows($callback, [IntPtr]::Zero) | Out-Null
$matching = @($candidates | Where-Object { $_.width -eq $ClientWidth -and $_.height -eq $ClientHeight })
if ($matching.Count -ne 1) { throw ("Expected one window matching viewport {0}x{1}, found: {2}" -f $ClientWidth, $ClientHeight, ($candidates | ConvertTo-Json -Compress)) }
$handle = [IntPtr]$matching[0].handle
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
@{ processId=$TargetProcessId; screenX=$point.X; screenY=$point.Y; handle=$handle.ToInt64(); defaultMainHandle=$target.MainWindowHandle.ToInt64(); candidates=@($candidates.ToArray()) } | ConvertTo-Json -Compress -Depth 4

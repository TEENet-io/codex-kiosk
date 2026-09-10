param(
    [Parameter(Mandatory=$true)][int]$TargetProcessId,
    [Parameter(Mandatory=$true)][int]$ClientX,
    [Parameter(Mandatory=$true)][int]$ClientY,
    [Parameter(Mandatory=$true)][int]$ClientWidth,
    [Parameter(Mandatory=$true)][int]$ClientHeight,
    [switch]$NoActivate,
    [int]$DragX = 0,
    [int]$DragY = 0,
    [switch]$ProbeBackground,
    [switch]$ClearLayered,
    [string]$ScreenshotPath
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
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
    [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT point);
    [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hwnd, int index);
    [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr hwnd, int index, int value);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll")] public static extern bool IsWindowEnabled(IntPtr hwnd);
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
if (-not $NoActivate -and -not $ProbeBackground) {
    [CodexNativeClick]::SetForegroundWindow($handle) | Out-Null
    Start-Sleep -Milliseconds 200
    if ([CodexNativeClick]::GetForegroundWindow() -ne $handle) { throw 'Target application did not receive foreground focus.' }
}
$before = New-Object CodexNativeClick+RECT
[CodexNativeClick]::GetWindowRect($handle, [ref]$before) | Out-Null
$point = New-Object CodexNativeClick+POINT
$point.X = $ClientX
$point.Y = $ClientY
if (-not [CodexNativeClick]::ClientToScreen($handle, [ref]$point)) { throw 'ClientToScreen failed.' }
if ($ProbeBackground) {
    Add-Type -AssemblyName System.Windows.Forms
    $form = New-Object System.Windows.Forms.Form
    $form.FormBorderStyle = 'None'
    $form.StartPosition = 'Manual'
    $form.Left = $before.Left
    $form.Top = $before.Top
    $form.Width = $ClientWidth
    $form.Height = $ClientHeight
    $button = New-Object System.Windows.Forms.Button
    $button.Dock = 'Fill'
    $button.Text = 'Desktop click-through probe'
    $script:backgroundClicks = 0
    $button.add_Click({ $script:backgroundClicks++ })
    $form.Controls.Add($button)
    $form.Show()
    [System.Windows.Forms.Application]::DoEvents()
}
if (-not [CodexNativeClick]::SetCursorPos($point.X, $point.Y)) { throw 'SetCursorPos failed.' }
Start-Sleep -Milliseconds 700
if ($ClearLayered -and -not $ProbeBackground) {
    $style = [CodexNativeClick]::GetWindowLong($handle, -20)
    [CodexNativeClick]::SetWindowLong($handle, -20, ($style -band (-bnot 0x80000))) | Out-Null
    [CodexNativeClick]::SetWindowPos($handle, [IntPtr]::Zero, 0, 0, 0, 0, 0x37) | Out-Null
    Start-Sleep -Milliseconds 100
}
$hitHandle = [CodexNativeClick]::WindowFromPoint($point)
$extendedStyle = [CodexNativeClick]::GetWindowLong($handle, -20)
[CodexNativeClick]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 80
if ($DragX -ne 0 -or $DragY -ne 0) {
    for ($step = 1; $step -le 20; $step++) {
        [CodexNativeClick]::SetCursorPos($point.X + [int]($DragX * $step / 20), $point.Y + [int]($DragY * $step / 20)) | Out-Null
        Start-Sleep -Milliseconds 30
    }
    Start-Sleep -Milliseconds 500
}
[CodexNativeClick]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 700
$after = New-Object CodexNativeClick+RECT
[CodexNativeClick]::GetWindowRect($handle, [ref]$after) | Out-Null
if ($ProbeBackground) {
    [System.Windows.Forms.Application]::DoEvents()
    $form.Close()
}
if ($ScreenshotPath) {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $screen = [System.Windows.Forms.SystemInformation]::VirtualScreen
    $bitmap = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.CopyFromScreen($screen.Left, $screen.Top, 0, 0, $bitmap.Size)
    $bitmap.Save($ScreenshotPath)
    $graphics.Dispose()
    $bitmap.Dispose()
}
@{ processId=$TargetProcessId; screenX=$point.X; screenY=$point.Y; handle=$handle.ToInt64(); hitHandle=$hitHandle.ToInt64(); extendedStyle=$extendedStyle; enabled=[CodexNativeClick]::IsWindowEnabled($handle); visible=[CodexNativeClick]::IsWindowVisible($handle); defaultMainHandle=$target.MainWindowHandle.ToInt64(); candidates=@($candidates.ToArray()); before=$before; after=$after; backgroundClicks=$script:backgroundClicks } | ConvertTo-Json -Compress -Depth 4

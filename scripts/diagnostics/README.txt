Codex 26.901 startup trace

1. Close Codex completely.
2. Extract all files from this ZIP into one directory.
3. Double-click Trace-CodexStartup.cmd.
   Default install: C:\Users\<user>\Codex.
   For another installation, run:
   Trace-CodexStartup.cmd -InstallDir "C:\Tools\Codex"
4. Wait 15 seconds after Codex opens. Click Retry once, then close Codex completely.
5. Send the startup-trace.jsonl in the new report-* directory.

This is a diagnostic tool, not a fix or a new installer.
It keeps the existing profile and model configuration. It temporarily appends
a local tracer to patches\init.cjs and restores the original bytes on exit.
Tracing stops after two minutes and does not expose a remote debugging port.
The report contains function names and code locations, not API keys, RPC
bodies, chat contents, local scope variables or exception messages.
If the console is forcibly terminated, the backup remains beside init.cjs as
init.cjs.backup-<id>. Without the trace environment variable the hook is inert.
Restore that backup before moving or deleting this diagnostic directory.

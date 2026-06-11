// tee.js — synchronous "save the full output before compressing" safety net.
// Sync because the tool_result_persist hook is sync. Best-effort: never throws.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

let counter = 0;

/** Write the full text to `<teeDir>/out-<stamp>-<pid>-<n>.log`; return the path (or null on failure). */
export function teeFullSync(text, teeDir) {
  try {
    mkdirSync(teeDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const file = join(teeDir, `out-${stamp}-${process.pid}-${counter++}.log`);
    writeFileSync(file, text);
    return file;
  } catch {
    return null;
  }
}

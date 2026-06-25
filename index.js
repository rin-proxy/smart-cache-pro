// smart-cache-pro — the typed-plugin (v2) of smart-cache.
// Engine A: AUTO-compress verbose tool output via `tool_result_persist` (sync) — no agent action.
// Engine B: deterministic pre-compaction snapshot via `before_compaction` — no agent discipline needed.
// Grounded against openclaw@2026.5.28 hook types. Defensive: any error leaves the original untouched.
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { compress, detectKind, lineCount } from "./src/compress.js";
import { teeFullSync } from "./src/tee.js";

export default definePluginEntry({
  id: "smart-cache-pro",
  name: "Smart Cache Pro",
  description:
    "Automatic RTK-style compression of verbose tool output (tool_result_persist) + deterministic pre-compaction snapshot (before_compaction). The enforced, no-agent-discipline-needed version of smart-cache.",
  register(api) {
    const cfg = api.pluginConfig ?? {};
    if (cfg.enabled === false) {
      api.logger?.info?.("smart-cache-pro disabled via config");
      return;
    }
    const minLines = Number.isInteger(cfg.minLines) ? cfg.minLines : 40;
    const denyTools = new Set(Array.isArray(cfg.denyTools) ? cfg.denyTools : []);
    const ws =
      process.env.OPENCLAW_WORKSPACE ||
      api.config?.workspaceDir ||
      join(homedir(), ".openclaw", "workspace");
    const cacheDir = join(ws, "memory", "cache");
    const teeDir = cfg.teeDir || join(cacheDir, "tee");
    const compDir = join(cacheDir, ".compaction");
    const statsFile = join(cacheDir, "stats.jsonl");          // v0.2.0 — savings ledger (one line / compression)
    const log = api.logger;

    // ── Engine A — auto-compress verbose tool output. SYNC: no async/await here. ──
    api.on("tool_result_persist", (event, ctx) => {
      try {
        if (denyTools.has(ctx?.toolName ?? event?.toolName)) return;
        const msg = event?.message;
        const blocks = Array.isArray(msg?.content) ? msg.content : null;
        if (!blocks) return;
        const i = blocks.findIndex((b) => b?.type === "text" && typeof b.text === "string");
        if (i < 0) return;
        const text = blocks[i].text;
        if (lineCount(text) < minLines) return;             // leave small results alone
        const teePath = teeFullSync(text, teeDir);           // save FULL output first (nothing lost)
        const kind = detectKind(text);
        const out = compress(text, kind, { maxLines: minLines });
        if (!out) return;                                    // compression wouldn't help → untouched
        try {                                                // v0.2.0 — savings ledger (best-effort; never affects the result)
          mkdirSync(cacheDir, { recursive: true });
          appendFileSync(statsFile, JSON.stringify({
            at: new Date().toISOString(),
            tool: ctx?.toolName ?? event?.toolName ?? "?",
            kind,
            linesIn: lineCount(text), linesOut: lineCount(out),
            charsIn: text.length, charsOut: out.length,
          }) + "\n");
        } catch { /* stats are best-effort — never let a ledger write affect the tool result */ }
        const content = blocks.slice();
        content[i] = { type: "text", text: out + (teePath ? `\n[full output: ${teePath}]` : "") };
        return { message: { ...msg, content } };             // ← replaces the persisted tool result
      } catch (err) {
        log?.warn?.(`[smart-cache-pro] tool_result_persist failed (left original): ${String(err)}`);
        return; // never break a tool call
      }
    });

    // ── Engine B — deterministic snapshot the instant the session is about to compact. ──
    // Unlike the v1 file-hook (metadata only), this typed hook receives event.messages, so we
    // can persist them ourselves — nothing depends on the agent remembering to flush.
    api.on("before_compaction", (event) => {
      try {
        mkdirSync(compDir, { recursive: true });
        const at = new Date().toISOString();
        if (Array.isArray(event?.messages) && event.messages.length) {
          const file = join(compDir, `snapshot-${at.replace(/[:.]/g, "-")}.json`);
          writeFileSync(
            file,
            JSON.stringify({ at, messageCount: event.messageCount, messages: event.messages }, null, 2),
          );
        }
        appendFileSync(
          join(compDir, "audit.log"),
          `${at} before_compaction messageCount=${event?.messageCount ?? "?"} tokenCount=${event?.tokenCount ?? "?"} snapshot=saved\n`,
        );
      } catch (err) {
        log?.warn?.(`[smart-cache-pro] before_compaction snapshot failed: ${String(err)}`);
      }
    });

    // ── Audit how much each compaction actually reclaimed (makes silent loss visible). ──
    api.on("after_compaction", (event) => {
      try {
        mkdirSync(compDir, { recursive: true });
        appendFileSync(
          join(compDir, "audit.log"),
          `${new Date().toISOString()} after_compaction compactedCount=${event?.compactedCount ?? "?"} tokenCount=${event?.tokenCount ?? "?"}\n`,
        );
      } catch { /* best-effort */ }
    });

    log?.info?.("smart-cache-pro active — auto-compress (tool_result_persist) + pre-compaction snapshot");
  },
});

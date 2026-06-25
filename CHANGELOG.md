# Changelog — smart-cache-pro

## 0.3.0 (2026-06-25)
- **Retention / auto-cleanup** — on load, prune `tee/` outputs and `.compaction/` snapshots older
  than `retentionDays` (default 14; `0` = keep forever). `audit.log` and the `stats.jsonl` ledger are
  never pruned. Best-effort; closes the "no auto-cleanup yet" gap from v0.1.0–0.2.0.

## 0.2.0 (2026-06-25)
- **Savings ledger** — Engine A now appends one line per compression to
  `memory/cache/stats.jsonl` (`at, tool, kind, linesIn/Out, charsIn/Out`). Best-effort and
  wrapped in its own try/catch, so a ledger write can never affect the tool result.
- **`scripts/report.mjs`** — prints a savings report (today + all-time): lines/tokens saved,
  breakdown by output kind, top tools, and pre-compaction snapshot counts. Pure Node, no deps.
  `node scripts/report.mjs [--brief] [--rate <usd/Mtok>] [--workspace <dir>]` (also `npm run report`).
- Token figures are explicit **estimates** (`chars ÷ 4`), never billed counts — receipts, not claims.

## 0.1.0 (2026-06-11)
- Initial typed-plugin (v2) build of smart-cache.
- **Engine A** — `tool_result_persist` (SYNC) auto-compresses verbose tool output. RTK-style
  filters (gitdiff / log / grep / tree / generic) ported from v1 `compress.sh` → JS, with the
  tee safety-net and safe-fail invariant preserved.
- **Engine B** — `before_compaction` writes a deterministic snapshot of the pre-compaction
  messages; `after_compaction` records the reclaim (audit trail makes silent loss visible).
- Compressor unit-tested (`node test/compress.test.mjs`).
- ✅ Validated on a live OpenClaw 2026.5.28: Gate-1 (loads, 3 hooks register) + Gate-2 (a real
  150-line `seq` tool output auto-compressed, full output tee'd). Subagent coverage gap: openclaw#60209.

# Changelog — smart-cache-pro

## 0.1.0 (2026-06-11) — unreleased / not yet live-tested
- Initial typed-plugin (v2) build of smart-cache.
- **Engine A** — `tool_result_persist` (SYNC) auto-compresses verbose tool output. RTK-style
  filters (gitdiff / log / grep / tree / generic) ported from v1 `compress.sh` → JS, with the
  tee safety-net and safe-fail invariant preserved.
- **Engine B** — `before_compaction` writes a deterministic snapshot of the pre-compaction
  messages; `after_compaction` records the reclaim (audit trail makes silent loss visible).
- Compressor unit-tested (`node test/compress.test.mjs`).
- ⚠️ Not yet validated on a live OpenClaw gateway. Subagent coverage gap: openclaw#60209.

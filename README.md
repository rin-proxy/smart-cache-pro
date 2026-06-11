# 💾⚡ Smart Cache Pro — automatic token discipline for OpenClaw

The **typed-plugin (v2)** of `smart-cache`. Where the free skill is *advisory* (you pipe
output manually + it nudges the agent), **Pro is automatic and enforced** — it intercepts at
the agent runtime, no agent discipline required.

## Two engines, both automatic
1. **Auto-compress** — a `tool_result_persist` hook compresses every verbose tool result
   (RTK-style: dedup / group-by-file / smart-truncate) **before it enters context**. The full
   output is tee'd to disk first, so nothing is ever lost. Zero agent action.
2. **Pre-compaction snapshot** — a `before_compaction` hook deterministically snapshots the
   about-to-be-compacted messages to `memory/cache/.compaction/`, and audits each compaction.
   Nothing depends on the agent remembering to save.

## Install
```bash
openclaw plugins install git:OWNER/smart-cache-pro    # or a path / clawhub:OWNER/smart-cache-pro
openclaw plugins enable smart-cache-pro
```
Config (plugin config in `openclaw.json`): `enabled`, `minLines`, `teeDir`, `denyTools`.

## Test the compressor standalone (no OpenClaw needed)
```bash
node test/compress.test.mjs
```

## vs the free smart-cache
| | smart-cache (free skill) | smart-cache-pro (this) |
|---|---|---|
| Compress verbose output | manual `compress.sh` pipe | **automatic** (`tool_result_persist`) |
| Save before compaction | *nudge* the agent | **deterministic snapshot** (`before_compaction`) |
| Hook tier | file-hook (observe-only) | typed plugin (intercepts/rewrites) |

## Status
**v0.1.0** — grounded against `openclaw@2026.5.28` hook types; compressor unit-tested (9/9).
**Gate-1 live-test PASSED** on a real OpenClaw 2026.5.28 gateway: the plugin loads, all 3 hooks
register, and `register()` runs. Gate-2 (a verbose tool-output getting rewritten end-to-end) lands
the first time a big tool runs after install. Known gap: `tool_result_persist` does not fire in
embedded/subagent runs ([openclaw#60209](https://github.com/openclaw/openclaw/issues/60209)).

*By Rin / DemiGod.*

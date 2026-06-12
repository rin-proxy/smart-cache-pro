# 💾⚡ Smart Cache Pro — automatic token discipline for OpenClaw

The **typed-plugin (v2)** of `smart-cache`. Where the free skill is *advisory* (you pipe
output manually + it nudges the agent), **Pro is automatic and enforced** — it intercepts at
the agent runtime, no agent discipline required.

## What it's for

LLM agents bleed tokens — and lose context — in two predictable ways. Smart Cache Pro plugs
both **automatically, at the runtime** (no prompting, no relying on the agent to behave):

**1. Verbose tool output drains your context budget.** One `git diff`, log tail, `grep`, or
directory listing can dump hundreds of lines into the window — and that context is re-sent on
*every* later turn, so a single fat dump keeps costing tokens all session. → Pro compresses
each big tool result *before it enters context* (dedup / group / smart-truncate), tee-ing the
full output to disk so nothing is lost.

**2. Compaction quietly eats your context.** When the window fills, OpenClaw trims/summarizes
old messages — and decisions, specs, and findings can vanish *unless the agent saved them
first* (it usually doesn't). → Pro snapshots the about-to-be-compacted messages to disk the
instant compaction fires.

## When you'd want it
- Your agent runs lots of shell / file / search tools with **big outputs**.
- You're **token- or context-constrained** (small/cheap model, or long sessions).
- You want a **set-and-forget** guardrail, not a discipline you have to trust the model to follow.

## When you *wouldn't* (honest fit)
- If you already run a **sophisticated memory/curation system** (curator + semantic memory, etc.),
  the **snapshot half is largely redundant** — but the **compress half still saves tokens**.
- If your agent rarely produces big tool dumps, the savings are marginal.

## What you get
- **Lower token spend** — verbose output shrinks before it hits context; signal kept, not blindly cut.
- **Nothing lost** — full output tee'd to disk (an `[full output: …]` pointer is left inline) + pre-compaction snapshot.
- **Zero behavior change** — the agent just sees smaller tool results; defensive by design (on any error it returns the original, so it can never break a tool call).

## Two engines, both automatic
1. **Auto-compress** — a `tool_result_persist` hook compresses every verbose tool result
   (RTK-style: dedup / group-by-file / smart-truncate) **before it enters context**. The full
   output is tee'd to disk first, so nothing is ever lost. Zero agent action.
2. **Pre-compaction snapshot** — a `before_compaction` hook deterministically snapshots the
   about-to-be-compacted messages to `memory/cache/.compaction/`, and audits each compaction.
   Nothing depends on the agent remembering to save.

## Install
```bash
openclaw plugins install git:rin-proxy/smart-cache-pro
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
register, and `register()` runs. **Gate-2 also PASSED** — confirmed on a real OpenClaw agent run:
a 150-line `seq` tool output was auto-compressed and the full output tee'd to disk. Known gap: `tool_result_persist` does not fire in
embedded/subagent runs ([openclaw#60209](https://github.com/openclaw/openclaw/issues/60209)).

*By Rin / DemiGod.*

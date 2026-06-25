#!/usr/bin/env node
// report.mjs — Smart Cache Pro savings report.
// Reads the v0.2.0 ledger (memory/cache/stats.jsonl) + the compaction audit log
// and prints what was saved. Pure Node, no deps, best-effort: malformed lines are
// skipped, the script never throws, and "saved" never means "lost" (full output is
// always on disk under memory/cache/tee/). Token figures are estimates (chars / 4).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };

if (has("--help") || has("-h")) {
  console.log(`Smart Cache Pro — savings report
  node scripts/report.mjs [options]
    --brief             one-line summary
    --rate <usd>        also show est. cost saved at <usd> per 1M tokens (your number)
    --workspace <dir>   workspace dir (default: $OPENCLAW_WORKSPACE or ~/.openclaw/workspace)`);
  process.exit(0);
}

const ws = val("--workspace") || process.env.OPENCLAW_WORKSPACE || join(homedir(), ".openclaw", "workspace");
const cacheDir = join(ws, "memory", "cache");
const statsFile = join(cacheDir, "stats.jsonl");
const auditFile = join(cacheDir, ".compaction", "audit.log");
const rate = val("--rate") != null ? Number(val("--rate")) : null;

// ── read the ledger (best-effort; skip any malformed line) ──
let rows = [];
try {
  rows = readFileSync(statsFile, "utf8").split("\n").map((l) => l.trim()).filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
} catch { /* no ledger yet */ }

if (!rows.length) {
  console.log("Smart Cache Pro — no compressions recorded yet.");
  console.log(`(looked in ${statsFile})`);
  process.exit(0);
}

const today = new Date().toISOString().slice(0, 10);
const isToday = (r) => typeof r.at === "string" && r.at.slice(0, 10) === today;

function agg(list) {
  const a = { dumps: 0, linesIn: 0, linesOut: 0, charsIn: 0, charsOut: 0, byKind: {}, byTool: {} };
  for (const r of list) {
    a.dumps++;
    a.linesIn += r.linesIn || 0; a.linesOut += r.linesOut || 0;
    a.charsIn += r.charsIn || 0; a.charsOut += r.charsOut || 0;
    const ls = (r.linesIn || 0) - (r.linesOut || 0);
    const k = r.kind || "generic";
    (a.byKind[k] ??= { dumps: 0, linesSaved: 0 }); a.byKind[k].dumps++; a.byKind[k].linesSaved += ls;
    const t = r.tool || "?";
    (a.byTool[t] ??= { dumps: 0, linesSaved: 0 }); a.byTool[t].dumps++; a.byTool[t].linesSaved += ls;
  }
  return a;
}
const A = agg(rows), T = agg(rows.filter(isToday));

// ── compaction audit (before_compaction lines only) ──
const comp = { total: 0, today: 0, messages: 0, last: null };
try {
  for (const l of readFileSync(auditFile, "utf8").split("\n")) {
    if (!l.includes("before_compaction")) continue;
    comp.total++;
    const at = l.slice(0, 24);
    if (at.slice(0, 10) === today) comp.today++;
    const m = l.match(/messageCount=(\d+)/); if (m) comp.messages += Number(m[1]);
    comp.last = at;
  }
} catch { /* no audit yet */ }

// ── formatting helpers ──
const n = (x) => Number(x || 0).toLocaleString("en-US");
const tok = (chars) => { const t = (chars || 0) / 4; if (t >= 100000) return "~" + Math.round(t / 1000) + "k"; if (t >= 1000) return "~" + (t / 1000).toFixed(1) + "k"; return "~" + Math.round(t); };
const pct = (inn, out) => inn > 0 ? Math.round((1 - out / inn) * 100) + "%" : "—";
const savedTok = (a) => tok(a.charsIn - a.charsOut);
const savedLines = (a) => a.linesIn - a.linesOut;

if (has("--brief")) {
  console.log(`Smart Cache Pro · today ${n(T.dumps)} dumps, ${n(savedLines(T))} lines (${savedTok(T)} tok est.) saved · ${comp.today} snapshot${comp.today === 1 ? "" : "s"} · all-time ${savedTok(A)} tok`);
  process.exit(0);
}

const P = "  ";
const r2 = (label, a, b) => P + String(label).padEnd(32) + String(a).padStart(12) + String(b).padStart(16);
const line = P + "─".repeat(60);

console.log("");
console.log(P + "Smart Cache Pro — savings report");
console.log(P + `workspace: ${ws}`);
console.log("");
console.log(r2("COMPRESSION (tool output)", "today", "all-time"));
console.log(line);
console.log(r2("tool dumps compressed", n(T.dumps), n(A.dumps)));
console.log(r2("lines  in → out", `${n(T.linesIn)} → ${n(T.linesOut)}`, `${n(A.linesIn)} → ${n(A.linesOut)}`));
console.log(r2("lines saved", n(savedLines(T)), n(savedLines(A))));
console.log(r2("est. tokens saved  (~chars÷4)", savedTok(T), savedTok(A)));
console.log(r2("avg compression", pct(T.linesIn, T.linesOut), pct(A.linesIn, A.linesOut)));
if (rate != null && !Number.isNaN(rate)) {
  const cost = (c) => "$" + ((c.charsIn - c.charsOut) / 4 / 1e6 * rate).toFixed(2);
  console.log(r2(`est. cost saved  (@ $${rate}/Mtok)`, cost(T), cost(A)));
}

// ── by output kind ──
console.log("");
const KORDER = ["gitdiff", "log", "grep", "tree", "generic"];
const totalSaved = Object.values(A.byKind).reduce((s, k) => s + k.linesSaved, 0) || 1;
console.log(P + "BY OUTPUT KIND (all-time)".padEnd(32) + "dumps".padStart(10) + "lines saved".padStart(14) + "share".padStart(8));
console.log(line);
for (const k of KORDER) {
  const e = A.byKind[k]; if (!e) continue;
  console.log(P + k.padEnd(32) + n(e.dumps).padStart(10) + n(e.linesSaved).padStart(14) + (Math.round(e.linesSaved / totalSaved * 100) + "%").padStart(8));
}

// ── top tools ──
console.log("");
console.log(P + "TOP TOOLS BY SAVINGS (all-time)".padEnd(36) + "dumps".padStart(8) + "lines saved".padStart(14));
console.log(line);
Object.entries(A.byTool).sort((a, b) => b[1].linesSaved - a[1].linesSaved).slice(0, 6)
  .forEach(([t, e]) => console.log(P + String(t).padEnd(36) + n(e.dumps).padStart(8) + n(e.linesSaved).padStart(14)));

// ── pre-compaction snapshots ──
console.log("");
console.log(P + "PRE-COMPACTION SNAPSHOTS");
console.log(line);
console.log(r2("compactions captured", n(comp.total), `(today: ${comp.today})`));
console.log(r2("messages snapshotted", n(comp.messages), ""));
if (comp.last) console.log(P + "last snapshot   " + comp.last.replace("T", " ").slice(0, 16) + " → memory/cache/.compaction/");

console.log("");
console.log(P + "Full outputs preserved in memory/cache/tee/ — nothing lost.");
console.log(P + "Token figures are estimates (chars ÷ 4), not billed counts.");
console.log("");

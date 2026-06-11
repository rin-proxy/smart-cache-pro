// compress.js — RTK-style tool-output compression, ported from smart-cache v1 `compress.sh`.
// PURE + SYNCHRONOUS (no I/O, no deps) so it is safe inside the sync `tool_result_persist`
// hook and unit-testable with plain `node`. Filters: gitdiff · log · grep · tree · generic.

const ANSI = /\x1b\[[0-9;]*[a-zA-Z]/g;

/** Strip ANSI escapes + trailing whitespace (RTK "smart filtering"). */
export function stripNoise(s) {
  return s.replace(ANSI, "").replace(/[ \t]+$/gm, "");
}

/** Line count (for the safe-fail size comparison). */
export function lineCount(s) {
  if (!s) return 0;
  const n = s.split("\n").length;
  return s.endsWith("\n") ? n - 1 : n;
}

/** Auto-detect the output type from the first ~1KB (RTK "peek + pick a filter"). */
export function detectKind(text) {
  const peek = text.slice(0, 1024);
  if (/^(diff --git |@@ |index [0-9a-f]+\.\.)/m.test(peek)) return "gitdiff";
  if (/^[dlpcbs-][rwx-]{9}|^total [0-9]+|^[├└│]/m.test(peek)) return "tree";
  if (/^[^:\n]+:[0-9]+:/m.test(peek)) return "grep";
  if (/\b(error|warn|info|debug|trace|fatal)\b|\[[0-9]{4}-[0-9]{2}-[0-9]{2}/i.test(peek)) return "log";
  return "generic";
}

/** Collapse identical consecutive lines into `line  (×N)` (RTK dedup). */
function dedup(lines) {
  const out = [];
  let prev = null, n = 0;
  for (const line of lines) {
    if (prev === null) { prev = line; n = 1; continue; }
    if (line === prev) { n++; continue; }
    out.push(n > 1 ? `${prev}  (×${n})` : prev);
    prev = line; n = 1;
  }
  if (prev !== null) out.push(n > 1 ? `${prev}  (×${n})` : prev);
  return out;
}

// keep file markers (+++/---) and real changes (+/-); drop @@ hunks, diff/index chrome, context
function filterGitdiff(lines) {
  const out = [];
  for (const l of lines) {
    if (/^\+\+\+ /.test(l) || /^--- /.test(l)) { out.push(l); continue; }
    if (/^@@/.test(l)) continue;
    if (/^diff --git/.test(l) || /^index /.test(l)) continue;
    if (/^[+-]/.test(l)) { out.push(l); continue; }
    // drop unchanged context lines
  }
  return out;
}

// dedup, then prefer error/warn lines (with a count of what was elided)
function filterLog(lines, origCount) {
  const dd = dedup(lines);
  const errs = dd.filter((l) => /\b(error|fatal|fail|exception|warn)\b/i.test(l));
  if (errs.length) return [...errs, "", `…(${origCount} non-error lines deduped — see tee)…`];
  return dd;
}

// group grep hits by file: "file: L12, L48, L91"
function filterGrep(lines) {
  const out = [];
  let cf = null, ls = "";
  for (const l of lines) {
    const m = l.match(/^([^:\n]+):([0-9]+):/);
    if (!m) continue;
    const f = m[1], ln = m[2];
    if (f !== cf) { if (cf !== null) out.push(`${cf}: ${ls}`); cf = f; ls = ln; }
    else ls += `, ${ln}`;
  }
  if (cf !== null) out.push(`${cf}: ${ls}`);
  return out;
}

// head + tail window, elide the middle (smart-truncate)
function filterGeneric(lines, maxLines) {
  const clean = lines.filter((l) => l.trim() !== "");
  if (clean.length <= maxLines) return clean;
  const h = Math.floor(maxLines / 2), t = maxLines - h;
  const elided = clean.length - h - t;
  return [...clean.slice(0, h), `…(${elided} lines elided — see tee)…`, ...clean.slice(clean.length - t)];
}

/**
 * Compress `text` using the given (or auto-detected) filter.
 * Returns the compressed string, or `null` if compression wouldn't help
 * (safe-fail invariant — the caller should then leave the original untouched).
 */
export function compress(text, kind, opts = {}) {
  const maxLines = Number.isInteger(opts.maxLines) ? opts.maxLines : 40;
  const k = kind ?? detectKind(text);
  const lines = stripNoise(text).split("\n");
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  const origCount = lines.length;

  let out;
  switch (k) {
    case "gitdiff": out = filterGitdiff(lines); break;
    case "log":     out = filterLog(lines, origCount); break;
    case "grep":    out = filterGrep(lines); break;
    case "tree":    out = dedup(lines); break;
    default:        out = filterGeneric(lines, maxLines); break;
  }

  // safe-fail: only return compression if it actually shrank the line count
  if (!out.length || out.length >= origCount) return null;
  return out.join("\n");
}

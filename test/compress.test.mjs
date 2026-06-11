// Standalone unit test for the ported compressor (no OpenClaw needed): `node test/compress.test.mjs`
import { compress, detectKind, lineCount, stripNoise } from "../src/compress.js";

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  if (got === want) { console.log(`✓ ${name}`); pass++; }
  else { console.log(`✗ ${name}\n   got : ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`); fail++; }
};
const ok = (name, cond) => { if (cond) { console.log(`✓ ${name}`); pass++; } else { console.log(`✗ ${name}`); fail++; } };

// 1) log dedup — the v1 verification case (a\na\na --kind log → "a  (×3)")
eq("log dedup → a (×3)", compress("a\na\na", "log"), "a  (×3)");

// 2) gitdiff — keep ± changes, drop @@ / diff / index / context
eq("gitdiff keeps changes only",
  compress("diff --git a/x b/x\n@@ -1 +1 @@\n-old\n+new\n unchanged", "gitdiff"),
  "-old\n+new");

// 3) grep — group hits by file
eq("grep groups by file",
  compress("a.js:12:foo\na.js:48:bar\nb.js:5:baz", "grep"),
  "a.js: 12, 48\nb.js: 5");

// 4) log with errors — surface errors + elision note
ok("log surfaces errors",
  (compress("info ok\ninfo ok\nERROR boom\ninfo ok\ninfo ok\ninfo ok", "log") || "").includes("ERROR boom"));

// 5) generic truncation — big output shrinks + marks elision
{
  const big = Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n");
  const out = compress(big, "generic", { maxLines: 10 });
  ok("generic truncates big output", !!out && lineCount(out) < 100 && out.includes("elided"));
}

// 6) safe-fail — tiny/incompressible returns null (caller leaves original)
eq("safe-fail null for tiny", compress("just one line", "generic"), null);

// 7) auto-detect
eq("detect gitdiff", detectKind("diff --git a/x b/x\nmore"), "gitdiff");
eq("detect grep", detectKind("file.js:10:match"), "grep");

// 8) ANSI stripped
eq("stripNoise removes ANSI", stripNoise("\x1b[31mred\x1b[0m"), "red");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { extname, join } from "node:path";

const roots = ["app", "console", "shared"];
const files = ["main.js", "preload.js"];

function collectJavaScriptFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) collectJavaScriptFiles(path);
    else if (extname(entry.name) === ".js") files.push(path);
  }
}

for (const root of roots) collectJavaScriptFiles(root);

for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
    stdio: "pipe"
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `Syntax check failed: ${file}\n`);
    process.exit(result.status || 1);
  }
}

console.log(`VROO_SYNTAX_CHECK_PASS ${files.length} files`);

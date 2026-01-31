import { chmodSync, readFileSync, writeFileSync } from "fs";

console.log("🏗️  Building Lib");
await Bun.build({
  entrypoints: ["src/index.ts"],
  outdir: "dist",
  target: "node",
  sourcemap: "external",
  // @ts-ignore
  packages: "external",
  minify: true,
});

console.log("🏗️  Building CLI");
await Bun.build({
  entrypoints: ["src/cli.ts"],
  outdir: "dist",
  target: "node",
  sourcemap: "none",
  minify: true,
});

// Add shebang to CLI and make it executable
console.log("Adding shebang to CLI");
const cliPath = "dist/cli.js";
const cliContent = readFileSync(cliPath, "utf-8");
if (!cliContent.startsWith("#!/")) {
  writeFileSync(cliPath, `#!/usr/bin/env node\n${cliContent}`);
}
chmodSync(cliPath, 0o755);

console.log("Build complete!");

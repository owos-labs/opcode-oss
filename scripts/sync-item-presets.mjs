import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(root, "..");
const nodeArgs = ["--experimental-strip-types", "--import", "./scripts/register-ts.mjs"];

function run(script) {
  const result = spawnSync(process.execPath, [...nodeArgs, script], {
    cwd: repo,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("scripts/build-ranged-presets.mjs");
run("scripts/build-ammo-presets-from-doc.mjs");
run("scripts/migrate-item-presets-dto.mjs");
run("scripts/sync-weapon-doc-from-rows.mjs");
console.log("item preset sync complete");

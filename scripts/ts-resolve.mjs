import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const known = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json"]);

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith(".") || known.has(extname(specifier))) {
    return nextResolve(specifier, context);
  }
  const base = join(dirname(fileURLToPath(context.parentURL)), specifier);
  for (const ext of [".ts", ".tsx", ".js"]) {
    if (existsSync(base + ext)) return { url: pathToFileURL(base + ext).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".json")) {
    const source = readFileSync(fileURLToPath(url), "utf8");
    return { format: "module", source: `export default ${source}`, shortCircuit: true };
  }
  return nextLoad(url, context);
}

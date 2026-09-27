import fs from "node:fs";
import { ROWS, rofFor, fireMode, parseWeight } from "./build-ranged-presets.mjs";

const DOC = "docs/武器 Placeholder 列表.md";
const rofByName = new Map(
  ROWS.map((row) => {
    const [name, , , , , , modes, weight] = row;
    return [name, rofFor(name, fireMode(modes), parseWeight(weight))];
  }),
);

function patchTableLine(line) {
  if (!line.startsWith("|")) return line;
  const parts = line.split("|");
  const name = parts[1]?.trim() ?? "";

  if (name === "武器名称") {
    if (line.includes("射速")) return line;
    for (let i = 1; i < parts.length; i++) {
      if (parts[i].includes("开火模式")) {
        parts.splice(i + 1, 0, " 射速 ");
        return parts.join("|");
      }
    }
    return line;
  }

  const isSep = parts.slice(1, 9).some((cell) => /^[\s-:]+$/.test(cell.trim()) && cell.includes("-"));
  if (isSep && !line.includes("射速") && parts.length >= 9) {
    for (let i = 1; i < parts.length; i++) {
      const t = parts[i].trim();
      if (t.startsWith("---") && i >= 7 && i <= 8) {
        const next = parts[i + 1]?.trim() ?? "";
        if (next.startsWith("---") && !/^\d/.test(next)) {
          parts.splice(i + 1, 0, " ---: ");
          return parts.join("|");
        }
      }
    }
  }

  const rof = rofByName.get(name);
  if (!rof) return line;

  const weightIdx = parts.findIndex((cell, idx) => idx > 6 && /kg/i.test(cell));
  if (weightIdx < 0) return line;

  const prev = parts[weightIdx - 1]?.trim() ?? "";
  if (/^\d+$/.test(prev)) {
    parts[weightIdx - 1] = ` ${rof} `;
    return parts.join("|");
  }
  parts.splice(weightIdx, 0, ` ${rof} `);
  return parts.join("|");
}

let md = fs.readFileSync(DOC, "utf8");
if (!md.includes("射速（ROF）")) {
  md = md.replace(
    "- 开火模式：`SA` 半自动，`FA` 全自动，`B` 点射，`M` 手动。\n",
    "- 开火模式：`SA` 半自动，`FA` 全自动，`B` 点射，`M` 手动。\n- 射速（ROF）：发/分；`M` 为手操射速。\n",
  );
}
md = md
  .split("\n")
  .map((line) => patchTableLine(line))
  .join("\n");
fs.writeFileSync(DOC, md);

let missing = 0;
for (const [name, rof] of rofByName) {
  if (!md.includes(`| ${name} |`) && !md.includes(`| ${name.replace(/"/g, '\\"')} |`)) {
    const hit = md.includes(name);
    if (!hit) missing++;
  }
  if (!md.includes(`| ${rof} |`) && !md.includes(` ${rof} |`)) {
    // rof values appear without always being surrounded by same spacing
  }
}
if (!md.includes("射速")) throw new Error("doc missing 射速 column");
console.log("synced rof for", rofByName.size, "weapons; doc rows missing name:", missing);

import fs from "node:fs";

import { ROWS, rofFor, fireMode, parseWeight } from "./build-ranged-presets.mjs";

const DOC = "docs/武器 Placeholder 列表.md";

function esc(cell) {
  return String(cell ?? "").replace(/\|/g, "\\|").trim();
}

function weaponTableRow(row) {
  const [name, reliability, accuracy, caliber, range, conceal, modes, weight, desc, attachment, , notes] = row;
  const rof = rofFor(name, fireMode(modes), parseWeight(weight));
  return `| ${esc(name)} | ${esc(reliability)} | ${esc(accuracy)} | ${esc(caliber)} | ${esc(range)} | ${esc(conceal)} | ${esc(modes)} | ${rof} | ${esc(weight)} | ${esc(desc)} | ${esc(attachment)} | ${esc(notes)} |`;
}

const header = [
  "| 武器名称 | 可靠性 | 精度 | 口径 | 射程 | 隐蔽性 | 开火模式 | 射速 | 重量 | 描述 | 附件 | 备注 |",
  "| --- | --- | ---: | --- | ---: | --- | --- | ---: | ---: | --- | --- | --- |",
].join("\n");
const table = `${header}\n${ROWS.map(weaponTableRow).join("\n")}\n`;

const md = fs.readFileSync(DOC, "utf8");
const tableStart = md.search(/\| 武器名称 \|/);
const caliberSection = md.indexOf("## caliber used");
if (tableStart < 0 || caliberSection < 0) throw new Error("weapon doc markers missing");

const next = `${md.slice(0, tableStart)}${table}\n${md.slice(caliberSection)}`;
fs.writeFileSync(DOC, next);
console.log("weapon doc rows", ROWS.length);

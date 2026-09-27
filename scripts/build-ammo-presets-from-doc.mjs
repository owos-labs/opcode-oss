import fs from "node:fs";

const DOC = "docs/武器 Placeholder 列表.md";
const PATH = "lib/character-sheets/item-presets.json";

const CREATED = {
  created_by: "00000000-0000-0000-0000-000000000000",
  created_at: "2026-09-27T00:00:00.000Z",
};

function clean(cell) {
  return String(cell ?? "").replace(/\*\*/g, "").trim();
}

function slug(name) {
  return name.toLowerCase().replaceAll("×", "x").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parseAmmoRows(md) {
  const start = md.indexOf("## 弹种");
  if (start < 0) throw new Error("ammo section missing");
  const rows = [];
  for (const line of md.slice(start).split("\n")) {
    if (!line.startsWith("|")) continue;
    if (line.includes("名称") || line.includes("---")) continue;
    const parts = line.split("|").map(clean);
    if (parts.length < 5) continue;
    const name = parts[1];
    const caliber = parts[2];
    const damage = parts[3];
    const penetration = Number(parts[4].replace(/[^\d]/g, ""));
    if (!name || !caliber || !damage || !Number.isFinite(penetration)) continue;
    rows.push({ name, caliber, damage, penetration });
  }
  return rows;
}

const rows = parseAmmoRows(fs.readFileSync(DOC, "utf8"));
if (rows.length !== 55) throw new Error(`expected 55 ammo rows, got ${rows.length}`);

const ammo = {};
for (const row of rows) {
  const id = `opcode-ammo-${slug(row.name)}`;
  ammo[id] = {
    ...CREATED,
    data: {
      id,
      name: row.name.replaceAll("×", "x"),
      type: "ammo",
      count: 1,
      ammo: {
        caliber: row.caliber.replaceAll("×", "x"),
        damage: "ball",
        penetration: row.penetration,
        ball: { damage: { dice: row.damage } },
      },
    },
  };
}

const raw = fs.readFileSync(PATH, "utf8");
const start = raw.indexOf('  "ammo": ');
const end = raw.indexOf('  "magazines": ');
const body = JSON.stringify(ammo, null, 2).split("\n").map((line, i) => (i === 0 ? line : `  ${line}`)).join("\n");
const next = `${raw.slice(0, start)}  "ammo": ${body},\n${raw.slice(end)}`;
JSON.parse(next);
fs.writeFileSync(PATH, next);
console.log("ammo", rows.length);

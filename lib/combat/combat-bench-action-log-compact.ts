const PLAN_KIND_SHORT: Record<string, string> = {
  move: "移",
  enter_cover: "进掩",
  leave_cover: "出掩",
  standard_fire: "射",
  suppressive_fire: "压",
  aim: "瞄",
  reload: "装",
  take_cover: "掩",
};

const ARMOR_KIND_SHORT: Record<string, string> = {
  过穿减骰: "过穿",
  穿透: "穿",
  欠穿: "欠穿",
};

function shortPlanTargetRef(tgt: string): string {
  if (/^[0-9a-f-]{8,}$/i.test(tgt)) return `@${tgt.slice(-4)}`;
  return `@${tgt}`;
}

function attackRangeNote(range: string, loc: string, cover: string): string {
  const l = Number(loc);
  const c = Number(cover);
  if (l === 0 && c === 0) return "";
  return ` · 距 ${range} 位 ${l} 掩 ${c}`;
}

/** Sidebar-friendly one-liners from verbose bench step text. */
export function compactActionLogDetailLine(line: string): string {
  const plan = line.match(
    /^R(\d+) (\w+)(→ \(([\d.]+), ([\d.]+)\) m)?( @ (.+?))? · (\w+)$/,
  );
  if (plan) {
    const kind = plan[2] ?? "";
    const x = plan[4];
    const y = plan[5];
    const tgt = plan[7];
    const timing = plan[8] ?? "";
    const kindShort = PLAN_KIND_SHORT[kind] ?? kind;
    const pos =
      x && y ? `→(${Math.round(Number(x))},${Math.round(Number(y))})` : "";
    const at = tgt ? shortPlanTargetRef(tgt.trim()) : "";
    const t = timing === "immediate" ? "即时" : timing;
    if (kindShort === "移" && x && y) {
      return `移动 (${Math.round(Number(x))}, ${Math.round(Number(y))}) · ${t}`;
    }
    if (kindShort === "进掩" && x && y) {
      return `进掩 (${Math.round(Number(x))}, ${Math.round(Number(y))}) · ${t}`;
    }
    if (kindShort === "出掩") {
      return `出掩 · ${t}`;
    }
    if (kindShort === "压" && !pos) {
      return `压制 · ${t}`;
    }
    return `${kindShort}${pos}${at} · ${t}`;
  }

  const attackFormula = line.match(
    /^对 (.+?) 射击检定：(1d10\[\d+\].*?)=(-?\d+) vs 难度(\d+)(?:\(距(\d+)\+位(\d+)\+掩(\d+)\))? → (命中|未中)/,
  );
  if (attackFormula) {
    const hit = attackFormula[8] === "命中" ? "命中" : "未中";
    const extra =
      attackFormula[5] != null
        ? attackRangeNote(attackFormula[5], attackFormula[6] ?? "0", attackFormula[7] ?? "0")
        : "";
    return `射击 ${attackFormula[1]} · ${attackFormula[2]}=${attackFormula[3]} vs ${attackFormula[4]}${extra} · ${hit}`;
  }

  const attack = line.match(
    /^对 (.+?) 射击检定：\[(\d+)\]\+(-?\d+)=(\d+) vs 难度(\d+)\(距(\d+)\+位(\d+)\+掩(\d+)\) → (命中|未中)/,
  );
  if (attack) {
    const hit = attack[9] === "命中" ? "命中" : "未中";
    const extra = attackRangeNote(attack[6], attack[7], attack[8]);
    return `射击 ${attack[1]} · ${attack[4]} vs ${attack[5]}${extra} · ${hit}`;
  }

  const attackLegacy = line.match(
    /^对 (.+?) 射击检定：\[(\d+)\]\+(-?\d+)=(\d+) vs 难度 (\d+) → (命中|未中)/,
  );
  if (attackLegacy) {
    return `射击 ${attackLegacy[1]} · ${attackLegacy[4]} vs ${attackLegacy[5]} · ${attackLegacy[6]}`;
  }

  const damageBlocked = line.match(/^伤害 \| 基(\d+)骰 挡-(\d+)骰 .+ → 0伤$/);
  if (damageBlocked) {
    return `伤害 0 · 基 ${damageBlocked[1]} 骰 · 挡 ${damageBlocked[2]} 骰`;
  }

  const damage = line.match(
    /^伤害 .+? \| 基(\d+)骰 挡-(\d+)骰→(\d+)骰 穿(\d+)\/AR(\d+)(?: 位(\S+))? (\S+) 掷(\d+)骰 → .+?=(\d+)(?: 简易×2)?(?: 头部致命)?(?: .+?剩(\d+))?$/,
  );
  if (damage) {
    const hp = damage[10] ? ` · 剩 HP ${damage[10]}` : "";
    const block = damage[2] !== "0" ? ` · 挡 ${damage[2]} 骰` : "";
    const ar =
      damage[5] === "0"
        ? `穿深 ${damage[4]}`
        : `穿深 ${damage[4]} / AR ${damage[5]}`;
    const kind = ARMOR_KIND_SHORT[damage[7]] ?? damage[7];
    const part = damage[6] ? ` · ${damage[6]}` : "";
    const crit = line.includes("简易×2") ? " · ×2" : "";
    const lethal = line.includes("头部致命") ? " · 致命" : "";
    return `伤害 ${damage[9]}${block} · ${ar} · ${kind}${part}${crit}${lethal}${hp}`;
  }

  const damageLegacy = line.match(
    /^伤害 .+? · .+? → .+? = (\d+).+?剩余生命 (\d+)/,
  );
  if (damageLegacy) {
    return `伤害 ${damageLegacy[1]} · 剩 HP ${damageLegacy[2]}`;
  }

  const suppressAmmo = line.match(/^压制 耗弹(\d+) 剩(\d+)$/);
  if (suppressAmmo) return `耗弹 ${suppressAmmo[1]} · 剩 ${suppressAmmo[2]}`;

  const suppressShot = line.match(
    /^射击检定：(1d10\[\d+\].*?)=(\d+) vs 难度(\d+)\(距(\d+)\+位(\d+)\+掩(\d+)\) → (成功|失败)/,
  );
  if (suppressShot) {
    const extra = attackRangeNote(suppressShot[4], suppressShot[5], suppressShot[6]);
    return `压制射击 · ${suppressShot[1]}=${suppressShot[2]} vs ${suppressShot[3]}${extra} · ${suppressShot[7]}`;
  }

  const reflex = line.match(
    /^(.+?) 反射豁免：1d10\[(\d+)\]\+REF(\d+)\+运动(\d+)=(\d+) vs (\d+) → (成功|失败)/,
  );
  if (reflex) {
    return `反射 ${reflex[1]} · ${reflex[5]} vs ${reflex[6]} · ${reflex[7]}`;
  }

  const suppressHits = line.match(
    /^(.+?) 压制次数：max\(1d(\d+)\[(\d+)\], 胜出(\d+)\) → (\d+)次/,
  );
  if (suppressHits) {
    return `压制 ${suppressHits[1]} · 1d${suppressHits[2]}[${suppressHits[3]}] 胜出${suppressHits[4]} → ${suppressHits[5]}次`;
  }

  const suppressZero = line.match(/^(.+?) 压制次数：max\(1d(\d+)\[(\d+)\], 胜出(\d+)\).+→ 0次（(.+)）/);
  if (suppressZero) {
    return `压制 ${suppressZero[1]} · 0次 · ${suppressZero[5]}`;
  }

  const suppressDmg = line.match(/^(.+?) 伤害 (\d+)(?: 剩(\d+))?/);
  if (suppressDmg) {
    const hp = suppressDmg[3] ? ` · 剩 HP ${suppressDmg[3]}` : "";
    return `伤害 ${suppressDmg[2]}${hp} · ${suppressDmg[1]}`;
  }

  const suppressDmgBlocked = line.match(/^(.+?) 压制伤害 0（(.+)）$/);
  if (suppressDmgBlocked) {
    return `伤害 0 · ${suppressDmgBlocked[1]} · ${suppressDmgBlocked[2]}`;
  }

  if (line.startsWith("视野 ") || line.startsWith("队长 ")) return line;

  if (line.startsWith("进入第 ") && line.includes("战斗轮")) {
    const m = line.match(/^进入第 (\d+) 战斗轮/);
    return m ? `进第${m[1]}轮` : line;
  }

  return line.length > 72 ? `${line.slice(0, 70)}…` : line;
}

/** Compact step lines and drop plan-fire rows when attack/damage lines carry the outcome. */
export function compactActionLogDetailLines(
  rawLines: readonly string[],
): string[] {
  const lines = rawLines.map(compactActionLogDetailLine);
  const hasFireOutcome = lines.some((l) => l.startsWith("射击 "));
  if (!hasFireOutcome) return lines;
  return lines.filter((l) => !/^射→/.test(l) && !l.startsWith("射→"));
}

export function compactActionLogStepSummary(input: {
  label: string;
  turn: { label: string; slot: number } | null;
  enteredNewCombatRound?: number;
}): string {
  const actor = input.turn
    ? `${input.turn.label} · 段 ${input.turn.slot + 1}`
    : input.label.split(" · ")[0] ?? input.label;
  if (input.enteredNewCombatRound != null) {
    return `进第 ${input.enteredNewCombatRound} 轮 · ${actor}`;
  }
  return actor;
}

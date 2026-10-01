export type ActionLogDetailKind =
  | "move"
  | "fire"
  | "damage"
  | "suppress"
  | "round"
  | "vision"
  | "leader"
  | "reason"
  | "other";

const KIND_LABEL: Record<ActionLogDetailKind, string> = {
  move: "移动",
  fire: "射击",
  damage: "伤害",
  suppress: "压制",
  round: "轮次",
  vision: "情报",
  leader: "队长",
  reason: "选择",
  other: "详情",
};

/** Classify a compact detail line for sidebar chips and layout. */
export function actionLogDetailKind(line: string): ActionLogDetailKind {
  if (line.startsWith("移动 ") || line === "不移动" || line.startsWith("不移动 ")) return "move";
  if (line.startsWith("射击 ")) return "fire";
  if (line.startsWith("伤害 ") || line.startsWith("0伤")) return "damage";
  if (line.startsWith("压制 ") || line.startsWith("耗弹 ")) return "suppress";
  if (line.startsWith("进第")) return "round";
  if (line.startsWith("情报 ") || line.startsWith("视野 ")) return "vision";
  if (line.startsWith("队长 ")) return "leader";
  if (line.startsWith("选择 ")) return "reason";
  return "other";
}

export function actionLogDetailKindLabel(kind: ActionLogDetailKind): string {
  return KIND_LABEL[kind];
}

/** Split a compact attack/damage line into stacked readable rows. */
export function expandReadableActionLogLines(line: string): readonly string[] {
  const fire = line.match(
    /^射击 (.+?) · (.+) vs (\d+)(?: · 距 (\d+) 位 (\d+) 掩 (\d+))? · (命中|未中)$/,
  );
  if (fire) {
    const rows = [`${fire[1]} · ${fire[2]} vs 难度 ${fire[3]}`];
    if (fire[4] != null) rows.push(`距离 ${fire[4]} · 定位 ${fire[5]} · 掩体 ${fire[6]}`);
    rows.push(`结果 ${fire[7]}`);
    return rows;
  }
  const damage = line.match(/^伤害 (\d+)(.*)$/);
  if (damage) {
    const extra = damage[2]?.replace(/^ · /, "").trim();
    return extra ? [`造成 ${damage[1]}`, extra] : [`造成 ${damage[1]}`];
  }
  return [line];
}

/** Text beside the kind chip (avoids repeating the category word). */
export function actionLogDetailBody(line: string, kind: ActionLogDetailKind): string {
  switch (kind) {
    case "move":
      return line.replace(/^(移动 |不移动 ?)/, "");
    case "fire":
      return line.replace(/^射击 /, "");
    case "damage":
      return line.replace(/^伤害 /, "");
    case "suppress":
      return line.replace(/^(压制|耗弹) /, "");
    case "round":
      return line.replace(/^进第 /, "第 ").replace(/轮 · /, " 轮 · ");
    case "vision":
      return line.replace(/^(情报|视野) /, "");
    case "leader":
      return line.replace(/^队长 /, "");
    case "reason":
      return line.replace(/^选择 /, "");
    default:
      return line;
  }
}

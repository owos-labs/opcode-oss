/** Outer radius of each Opcode 1.7 shot band. Point-blank is the fixed 2.5 m threshold. */
export function weaponRangeBandRadii(weaponRangeM: number): {
  id: "pointBlank" | "close" | "medium" | "far";
  label: string;
  radiusM: number;
}[] {
  if (!(weaponRangeM > 0)) return [];
  return [
    { id: "pointBlank", label: "贴身", radiusM: 2.5 },
    { id: "close", label: "近", radiusM: weaponRangeM * 0.5 },
    { id: "medium", label: "中", radiusM: weaponRangeM },
    { id: "far", label: "远", radiusM: weaponRangeM * 2 },
  ];
}

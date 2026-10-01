const GROUP_KEYS: Record<string, string> = {
  extensions: "lore.group.extensions",
};

export function loreGroupLabel(slug: string, t: (key: string) => string): string {
  const key = GROUP_KEYS[slug];
  if (!key) return slug;
  const label = t(key);
  return label === key ? slug : label;
}

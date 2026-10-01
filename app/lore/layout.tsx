import type { ReactNode } from "react";

import { LoreShell } from "@/app/components/lore-shell";
import { getLoreChapterTree } from "@/lib/lore/github-source";

export default async function LoreLayout({ children }: { children: ReactNode }) {
  const [cn, en] = await Promise.all([getLoreChapterTree("cn"), getLoreChapterTree("en")]);
  return <LoreShell trees={{ cn, en }}>{children}</LoreShell>;
}

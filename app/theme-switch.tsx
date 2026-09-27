"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { useT } from "@/lib/character-sheets/i18n";

const emptySubscribe = () => () => undefined;
const clientTrue = () => true;
const serverFalse = () => false;

export function ThemeSwitch() {
  const { t } = useT();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, clientTrue, serverFalse);
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={t(isDark ? "theme.dark" : "theme.light")}
      disabled={!mounted}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative grid h-10 w-[4.5rem] grid-cols-2 place-items-center rounded-[9999px] bg-foreground/10 disabled:opacity-60"
    >
      <span
        aria-hidden
        className={`absolute top-1 left-1 size-8 rounded-[9999px] bg-primary transition-transform duration-150 motion-reduce:transition-none ${
          isDark ? "translate-x-full" : "translate-x-0"
        }`}
      />
      <Sun className={`relative size-4 transition-colors duration-150 ${isDark ? "text-foreground/50" : "text-background"}`} />
      <Moon className={`relative size-4 transition-colors duration-150 ${isDark ? "text-background" : "text-foreground/50"}`} />
    </button>
  );
}

"use client";

import { useRef, type ReactNode } from "react";

export function CombatMapImportInput({
  children,
  onPick,
}: {
  children: (open: () => void) => ReactNode;
  onPick: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onPick(file);
        }}
      />
      {children(() => inputRef.current?.click())}
    </>
  );
}

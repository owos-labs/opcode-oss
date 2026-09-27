"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export function BenchControlButton({
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button type="button" className={className} {...rest}>
      {children}
    </button>
  );
}

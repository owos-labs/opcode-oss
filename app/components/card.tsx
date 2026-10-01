"use client";

import { Card as HeroCard } from "@heroui/react";
import {
  useRef,
  type ComponentProps,
  type ElementType,
  type MouseEvent,
  type ReactNode,
} from "react";

export type CardTone = "default" | "secondary" | "shell" | "transparent" | "danger";
export type CardRadius = "md" | "lg" | "xl" | "2xl" | "full";
export type CardPadding = false | "none" | "sm" | "md" | "lg";

const toneVariant: Record<CardTone, NonNullable<ComponentProps<typeof HeroCard>["variant"]>> = {
  default: "default",
  secondary: "secondary",
  shell: "tertiary",
  transparent: "transparent",
  danger: "default",
};

const radiusClass: Record<CardRadius, string> = {
  md: "!rounded-lg",
  lg: "!rounded-xl",
  xl: "!rounded-2xl",
  "2xl": "!rounded-3xl",
  full: "!rounded-full",
};

const paddingClass: Record<Exclude<CardPadding, false>, string> = {
  none: "!p-0 !gap-0",
  sm: "!p-2 !gap-2",
  md: "!p-4 !gap-3",
  lg: "!p-6 !gap-4",
};

export function cardSurfaceClass({
  tone = "default",
  radius = "lg",
  padding = "md",
  spotlight = true,
  className = "",
}: {
  tone?: CardTone;
  radius?: CardRadius;
  padding?: CardPadding;
  spotlight?: boolean;
  className?: string;
}) {
  return [
    spotlight && "oc-card-spotlight",
    radiusClass[radius],
    padding === false ? "" : paddingClass[padding === "none" ? "none" : padding || "md"],
    tone === "danger" && "!text-error",
    "border border-border1 border-2",
    "shadow1 text-foreground bg-content",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

type CardProps<E extends ElementType = "div"> = {
  as?: E;
  tone?: CardTone;
  radius?: CardRadius;
  padding?: CardPadding;
  spotlight?: boolean;
  className?: string;
  children?: ReactNode;
} & Omit<ComponentProps<E>, "as">;

function trackSpotlight(ref: React.RefObject<HTMLElement | null>, event: MouseEvent<HTMLElement>) {
  const node = ref.current;
  if (!node) return;
  const rect = node.getBoundingClientRect();
  node.style.setProperty("--spotlight-x", `${((event.clientX - rect.left) / rect.width) * 100}%`);
  node.style.setProperty("--spotlight-y", `${((event.clientY - rect.top) / rect.height) * 100}%`);
}

export function Card<E extends ElementType = "div">({
  as,
  tone = "default",
  radius = "lg",
  padding = "md",
  spotlight = true,
  className = "",
  children,
  onMouseMove,
  ...props
}: CardProps<E>) {
  const ref = useRef<HTMLElement>(null);
  const classes = cardSurfaceClass({ tone, radius, padding, spotlight, className });

  function handleMouseMove(event: MouseEvent<HTMLElement>) {
    if (spotlight) trackSpotlight(ref, event);
    onMouseMove?.(event as never);
  }

  if (as) {
    const Component = as;
    return (
      <Component
        ref={ref}
        className={`relative flex flex-col ${classes}`}
        onMouseMove={handleMouseMove}
        {...props}
      >
        {children}
      </Component>
    );
  }

  return (
    <HeroCard
      ref={ref as never}
      variant={toneVariant[tone]}
      className={classes}
      onMouseMove={handleMouseMove}
      {...props}
    >
      {children}
    </HeroCard>
  );
}

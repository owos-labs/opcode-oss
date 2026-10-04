"use client";

import { Card as HeroCard } from "@heroui/react";
import {
  createElement,
  useRef,
  type ComponentProps,
  type ElementType,
  type MouseEvent,
  type ReactNode,
} from "react";

import { cardSurfaceClass, type CardPadding, type CardRadius, type CardTone } from "./card-surface";

export type { CardPadding, CardRadius, CardTone } from "./card-surface";

const toneVariant: Record<CardTone, NonNullable<ComponentProps<typeof HeroCard>["variant"]>> = {
  default: "default",
  secondary: "secondary",
  shell: "tertiary",
  transparent: "transparent",
  danger: "default",
};

export { cardSurfaceClass } from "./card-surface";

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
    return createElement(as, {
      className: `relative flex flex-col ${classes}`,
      onMouseMove: handleMouseMove,
      ...props,
    } as ComponentProps<E>, children);
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

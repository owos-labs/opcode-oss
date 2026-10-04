export type CardTone = "default" | "secondary" | "shell" | "transparent" | "danger";
export type CardRadius = "md" | "lg" | "xl" | "2xl" | "full";
export type CardPadding = false | "none" | "sm" | "md" | "lg";

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
    "shadow1 text-foreground",
    tone === "shell" ? "bg-content1" : "bg-content3",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

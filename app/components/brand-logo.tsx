import type { CSSProperties } from "react";

export const BRAND_ASSETS = {
  logo: "/static/logo.svg",
  black: "/static/black.png",
  light: "/static/light.png",
} as const;

export function BrandLogo({
  bgColor,
  className = "",
  height = 32,
  paddingX = 12,
  paddingY = 8,
  style,
}: {
  bgColor?: string;
  className?: string;
  height?: number;
  paddingX?: number;
  paddingY?: number;
  style?: CSSProperties;
}) {
  const hasBg = bgColor != null && bgColor !== "transparent";
  return (
    <div
      className={`flex w-fit items-center justify-start ${hasBg ? "rounded-lg" : ""} ${className}`.trim()}
      style={{
        ...(hasBg ? { backgroundColor: bgColor, padding: `${paddingY}px ${paddingX}px` } : undefined),
        ...style,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BRAND_ASSETS.logo}
        alt="Opcode"
        draggable={false}
        className={hasBg ? "" : "invert dark:invert-0"}
        style={{ height, width: "auto", display: "block" }}
      />
    </div>
  );
}

const brandMarkFrame = "max-h-[min(420px,55vh)] w-auto max-w-2xl object-contain";

function BrandMarkLayer({
  src,
  className,
  lines,
}: {
  src: string;
  className: string;
  lines: readonly [string, string];
}) {
  const frame = `${brandMarkFrame} col-start-1 row-start-1`;
  return (
    <div className={`mx-auto flex w-fit max-w-full items-center justify-center gap-6 sm:gap-10 ${className}`.trim()}>
      <div className="grid shrink-0 place-items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          aria-hidden
          draggable={false}
          className={`pointer-events-none ${frame} scale-125 opacity-45 blur-[48px]`}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Opcode" draggable={false} className={`relative z-10 ${frame}`} />
      </div>
      <div className="flex shrink-0 flex-col leading-none tracking-tight text-hero">
        <span className="font-bold text-foreground">{lines[0]}</span>
        <span className="font-medium text-foreground/45">{lines[1]}</span>
      </div>
    </div>
  );
}

export function BrandMark({
  className = "",
  lines,
}: {
  className?: string;
  lines: readonly [string, string];
}) {
  return (
    <>
      <BrandMarkLayer src={BRAND_ASSETS.light} className={`dark:hidden ${className}`.trim()} lines={lines} />
      <BrandMarkLayer src={BRAND_ASSETS.black} className={`hidden dark:flex ${className}`.trim()} lines={lines} />
    </>
  );
}

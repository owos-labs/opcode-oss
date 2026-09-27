"use client";

import { Button, Card as HeroCard } from "@heroui/react";
import { Dropdown } from "@heroui/react/dropdown";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";

import { modalShortcutAction } from "@/lib/modal-shortcuts";

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-2">
      <span className="text-sm font-semibold text-foreground/70">{label}</span>
      {children}
      {error ? <span className="text-sm text-error">{error}</span> : null}
    </label>
  );
}

const fieldClass =
  "min-h-11 w-full rounded-lg border border-border1 bg-content3 px-4 py-3 font-medium shadow1 outline-none transition-colors duration-150 placeholder:text-foreground/40 hover:bg-content2 focus:border-primary focus:shadow-primary disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-error aria-[invalid=true]:focus:shadow-error";

export function TextField({
  label,
  error,
  value,
  onChange,
  disabled,
  placeholder,
  icon,
  type = "text",
  step,
}: {
  label: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  icon?: ReactNode;
  type?: "text" | "number";
  step?: number;
}) {
  return (
    <Field label={label} error={error}>
      {icon ? (
        <div className="flex min-h-11 items-center gap-3 rounded-lg border border-border1 bg-content3 px-3 shadow1 transition-colors duration-150 hover:bg-content2 focus-within:border-primary focus-within:shadow-primary">
          <span className="shrink-0 text-foreground/50">{icon}</span>
          <input
            type={type}
            step={step}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            onChange={(event) => onChange(event.target.value)}
            className="min-h-11 w-full bg-transparent font-medium outline-none placeholder:text-foreground/40 disabled:cursor-not-allowed"
          />
        </div>
      ) : (
        <input
          type={type}
          step={step}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={fieldClass}
        />
      )}
    </Field>
  );
}

export function AreaField({
  label,
  error,
  value,
  onChange,
  disabled,
  rows = 6,
}: {
  label: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  rows?: number;
}) {
  return (
    <Field label={label} error={error}>
      <textarea
        value={value}
        disabled={disabled}
        rows={rows}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`${fieldClass} resize-y`}
      />
    </Field>
  );
}

export function SelectField({
  label,
  error,
  hint,
  value,
  onChange,
  disabled,
  options,
  className,
  "aria-label": ariaLabel,
}: {
  label?: string;
  error?: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  options: { value: string; label: string }[];
  className?: string;
  "aria-label"?: string;
}) {
  const selected = options.find((option) => option.value === value)?.label ?? "";
  const control = (
    <Dropdown>
      <Dropdown.Trigger
        isDisabled={disabled}
        aria-label={label ? undefined : ariaLabel}
        aria-invalid={error ? true : undefined}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-border1 bg-content3 px-3 text-left text-sm font-medium shadow1 outline-none disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="min-w-0 truncate">{selected}</span>
        <ChevronDown className="size-4 shrink-0 opacity-60" />
      </Dropdown.Trigger>
      <Dropdown.Popover>
        <Dropdown.Menu
          aria-label={label || ariaLabel}
          onAction={(key) => onChange(String(key) === "__none__" ? "" : String(key))}
          // ponytail: empty option uses __none__ as its menu id; a real value of that name would collide
        >
          {options.map((option) => (
            <Dropdown.Item
              key={option.value || "__none__"}
              id={option.value || "__none__"}
              textValue={option.label}
            >
              {option.label}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className || ""}`}>
      {label ? <span className="text-sm font-semibold text-foreground/70">{label}</span> : null}
      {control}
      {hint ? <p className="text-xs leading-5 text-foreground/60">{hint}</p> : null}
      {error ? <span className="text-sm text-error">{error}</span> : null}
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 10,
  step = 1,
  disabled,
  label,
  error,
  display = "inline",
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  label?: string;
  error?: string;
  display?: "inline" | "dashboard" | "box";
  ariaLabel?: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const parsed = Number(value);
  const current = Number.isFinite(parsed) ? parsed : min;
  const clamped = Math.min(max, Math.max(min, current));
  const shown = editing ?? (value === "" ? "" : String(clamped));

  function commit(next: number) {
    const snapped = step === 1 ? Math.round(next) : Number((Math.round(next / step) * step).toFixed(4));
    onChange(String(Math.min(max, Math.max(min, snapped))));
  }

  const increment = (
    <button
      type="button"
      className="flex size-11 items-center justify-center rounded-md bg-content2 font-bold transition-colors duration-150 hover:bg-content3 focus-visible:shadow-primary disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled || clamped >= max}
      aria-label={`+${step}`}
      onClick={() => commit(current + step)}
    >
      <Plus className="size-4" />
    </button>
  );
  const decrement = (
    <button
      type="button"
      className="flex size-11 items-center justify-center rounded-md bg-content2 font-bold transition-colors duration-150 hover:bg-content3 focus-visible:shadow-primary disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled || clamped <= min}
      aria-label={`-${step}`}
      onClick={() => commit(current - step)}
    >
      <Minus className="size-4" />
    </button>
  );

  const input = (
    <input
      type="number"
      aria-label={ariaLabel || label}
      className={`bg-transparent text-center font-mono font-black tabular-nums outline-none [appearance:textfield] disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none ${
        display === "dashboard" ? "h-14 w-20 text-5xl" : "h-11 w-12 text-base"
      }`}
      value={shown}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(event) => {
        setEditing(event.target.value);
        const next = Number(event.target.value);
        if (Number.isFinite(next)) commit(next);
      }}
      onBlur={() => setEditing(null)}
    />
  );

  const body =
    display === "dashboard" ? (
      <div className="flex flex-col items-center gap-2">
        {input}
        <div className="flex gap-2">
          {increment}
          {decrement}
        </div>
      </div>
    ) : (
      <div
        className={
          display === "box"
            ? "flex h-11 w-max items-stretch overflow-hidden rounded-lg border border-border1 bg-content3 shadow1"
            : "inline-flex items-center gap-1"
        }
      >
        {increment}
        {input}
        {decrement}
      </div>
    );

  if (!label && !error) return body;
  return (
    <div className="flex flex-col gap-2">
      {label ? <span className="text-sm font-semibold text-foreground/70">{label}</span> : null}
      {body}
      {error ? <p className="text-sm text-error">{error}</p> : null}
    </div>
  );
}

export function Card({ className = "", ...props }: ComponentProps<typeof HeroCard>) {
  return (
    <HeroCard
      className={`rounded-lg border border-border1 bg-content3 text-foreground shadow1 ${className}`}
      {...props}
    />
  );
}

export function Notice({
  title,
  description,
  action,
  tone = "error",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: "error" | "muted";
}) {
  return (
    <Card
      className={`p-4 ${
        tone === "error" ? "border-error text-error" : "text-foreground/70"
      }`}
    >
      <p className="font-black">{title}</p>
      {description ? <p className="mt-1 text-sm">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </Card>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-h-5 min-w-5 items-center justify-center rounded border border-border1 bg-content3 px-1.5 font-mono text-[0.65rem] font-bold leading-none text-foreground/55 shadow-sm">
      {children}
    </kbd>
  );
}

function ModalShortcutLabel({ label, shortcut }: { label: ReactNode; shortcut: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      {label}
      <Kbd>{shortcut}</Kbd>
    </span>
  );
}

export function ModalShortcutFooter({
  cancelLabel,
  onCancel,
  confirmLabel,
  onConfirm,
  confirmVariant = "primary",
  confirmDisabled = false,
  confirmIcon,
  enterFromInputs = false,
}: {
  cancelLabel: ReactNode;
  onCancel: () => void;
  confirmLabel: ReactNode;
  onConfirm: () => void;
  confirmVariant?: ComponentProps<typeof Button>["variant"];
  confirmDisabled?: boolean;
  confirmIcon?: ReactNode;
  enterFromInputs?: boolean;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = modalShortcutAction(event.key, event.target, { confirmDisabled, enterFromInputs });
      if (action === "cancel") {
        event.preventDefault();
        onCancel();
      }
      if (action === "confirm") {
        event.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmDisabled, enterFromInputs, onCancel, onConfirm]);

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="outline" className="gap-2" onPress={onCancel}>
        <ModalShortcutLabel label={cancelLabel} shortcut="Esc" />
      </Button>
      <Button
        variant={confirmVariant}
        className="gap-2"
        isDisabled={confirmDisabled}
        onPress={onConfirm}
      >
        {confirmIcon}
        <ModalShortcutLabel label={confirmLabel} shortcut="Enter" />
      </Button>
    </div>
  );
}

export function download(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

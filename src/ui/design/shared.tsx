import type { AdvancedDesign, DesignLine, DesignSheet } from "../../design.ts";
import {
  customLabel,
  DRIVE_OPTIONS,
  type DriveComponent,
  type DriveCustom,
} from "../../catalog/drives.ts";
import { credits } from "../format.ts";

export function freshId(): string {
  return crypto.randomUUID();
}

export function money(mcr: number): string {
  return `${mcr.toLocaleString("en-US", { maximumFractionDigits: 4 })} MCr · ${
    credits(Math.round(mcr * 1_000_000))
  }`;
}

export function sheetCost(mcr: number): string {
  const amount = Math.round(mcr * 1_000_000);
  if (amount < 100_000) return credits(amount);
  return `${mcr.toLocaleString("en-US", { maximumFractionDigits: 3 })} MCr`;
}

export function tonLabel(value: number): string {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })} t`;
}

export function counted(label: string, count: number): string {
  const quantity = Math.round(count * 100) / 100;
  return quantity === 1 ? label : `${label} x${quantity}`;
}

/** Title plus the section's current values. The values show only while the section is collapsed. */
export function SectionHeading(
  { title, values }: { title: string; values: readonly string[] },
) {
  const summary = values.filter((value) => value.length > 0).join(" · ");
  return (
    <>
      {title}
      <span className="section-values">{summary || "None"}</span>
    </>
  );
}

export function customNote(
  component: DriveComponent,
  custom: DriveCustom | undefined,
): string {
  return customLabel(DRIVE_OPTIONS[component], custom);
}

export function componentNote(
  design: AdvancedDesign,
  line: Pick<DesignLine, "name" | "role">,
): string {
  if (line.role === "manoeuvre") {
    return customNote("thrust", design.driveCustom?.thrust);
  }
  if (line.role === "jump") return customNote("jump", design.driveCustom?.jump);
  if (line.role === "plant") {
    return customNote("plant", design.driveCustom?.plant);
  }
  if (line.name === "Staterooms") {
    const doubles = Math.min(
      design.staterooms,
      Math.max(0, Math.trunc(design.doubleStaterooms) || 0),
    );
    return doubles > 0 ? `${doubles} double occupancy` : "";
  }
  return "";
}

export function suppliedPower(
  design: AdvancedDesign,
  sheet: DesignSheet,
): number {
  const supplied = sheet.lines.find((line) => line.role === "plant")?.power;
  return supplied ?? (Number.isFinite(design.power) ? design.power : 0);
}

export function Choice<T extends string>(
  { label, note = "", value, options, disabled = false, onChange }: {
    label: string;
    note?: string;
    value: T;
    options: readonly { id: T; label: string }[];
    disabled?: boolean;
    onChange: (value: T) => void;
  },
) {
  return (
    <label>
      <span>
        {label}
        {note ? <small className="custom-note">({note})</small> : null}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value as T)}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

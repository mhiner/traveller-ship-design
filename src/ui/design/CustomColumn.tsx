import {
  DRIVE_CUSTOM_TIERS,
  type DriveCustom,
  type DriveCustomTier,
  driveEffectiveTons,
  type DriveOption,
  driveTier,
  legalCustomOptions,
} from "../../catalog/drives.ts";
import { NumberField } from "../fields.tsx";
import { Choice } from "./shared.tsx";

export function CustomColumn(
  { title, className, choices, custom, disabled, tonnage, onTier, onSet }: {
    title: string;
    className: string;
    choices: readonly DriveOption[];
    custom: DriveCustom;
    disabled: boolean;
    tonnage?: {
      hullTons: number;
      onChange: (tons: number | undefined) => void;
    };
    onTier: (tier: DriveCustomTier) => void;
    onSet: (id: string, count: number) => void;
  },
) {
  const tier = driveTier(custom.tier);
  const selected = legalCustomOptions(choices, custom);
  const used = selected.reduce((total, option) => total + option.slots, 0);
  const options = choices.filter((option) => option.kind === tier.kind);
  return (
    <div className={className}>
      <div>
        <h3>{title}</h3>
        {tonnage
          ? (
            <NumberField
              label="Effective tonnage"
              value={driveEffectiveTons(tonnage.hullTons, custom)}
              min={tonnage.hullTons}
              step={1}
              onChange={(value) => {
                if (!Number.isFinite(value)) return;
                const tons = Math.max(tonnage.hullTons, Math.round(value));
                tonnage.onChange(tons > tonnage.hullTons ? tons : undefined);
              }}
            />
          )
          : null}
      </div>
      <Choice
        label="Technology"
        value={custom.tier}
        options={DRIVE_CUSTOM_TIERS}
        disabled={disabled}
        onChange={onTier}
      />
      <p className="meta">
        {tier.slots > 0 && !disabled
          ? `${used} / ${tier.slots} ${
            tier.kind === "advantage" ? "advantages" : "disadvantages"
          }`
          : ""}
      </p>
      <div className="custom-list">
        {options.map((option) => {
          const count = selected.filter((row) => row.id === option.id).length;
          if (option.slots === 1) {
            const max = count + Math.max(0, tier.slots - used);
            return (
              <label className="check" key={option.id}>
                <input
                  type="number"
                  min={0}
                  max={max}
                  step={1}
                  value={count}
                  disabled={disabled || max === 0}
                  aria-label={`${option.label} count`}
                  onChange={(event) => {
                    const raw = Number(event.currentTarget.value);
                    const next = Number.isFinite(raw)
                      ? Math.min(max, Math.max(0, Math.round(raw)))
                      : 0;
                    onSet(option.id, next);
                  }}
                />
                {option.label}
              </label>
            );
          }
          const checked = count > 0;
          const blocked = disabled ||
            (!checked && used + option.slots > tier.slots);
          return (
            <label className="check" key={option.id}>
              <input
                type="checkbox"
                checked={checked}
                disabled={blocked}
                onChange={(event) =>
                  onSet(option.id, event.currentTarget.checked ? 1 : 0)}
              />
              {option.label} ({option.slots})
            </label>
          );
        })}
      </div>
    </div>
  );
}

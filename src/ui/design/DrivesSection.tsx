import { useState } from "../../runtime.ts";
import type { AdvancedDesign, DesignSheet } from "../../design.ts";
import {
  blankDriveCustom,
  DRIVE_OPTIONS,
  type DriveComponent,
  type DriveCustoms,
  type DriveCustomTier,
  JUMP_MIN_HULL_TONS,
  legalCustomOptions,
  powerPlantsAt,
} from "../../catalog/drives.ts";
import { containerCapacities } from "../../evaluate/drives.ts";
import { NumberField } from "../fields.tsx";
import { CustomColumn } from "./CustomColumn.tsx";
import {
  Choice,
  customNote,
  SectionHeading,
  suppliedPower,
  tonLabel,
  freshId,
} from "./shared.tsx";

function driveCustoms(design: AdvancedDesign): DriveCustoms {
  return {
    thrust: design.driveCustom?.thrust ?? blankDriveCustom(),
    jump: design.driveCustom?.jump ?? blankDriveCustom(),
    plant: design.driveCustom?.plant ?? blankDriveCustom(),
  };
}

function DriveCustomizer({ design, onChange, onSave }: {
  design: AdvancedDesign;
  onChange: (driveCustom: DriveCustoms) => void;
  onSave: () => void;
}) {
  const customs = driveCustoms(design);
  const setTier = (component: DriveComponent, tier: DriveCustomTier) => {
    const next = { ...customs[component], tier };
    onChange({
      ...customs,
      [component]: {
        ...next,
        options: legalCustomOptions(DRIVE_OPTIONS[component], next).map((
          option,
        ) => option.id),
      },
    });
  };
  const setCount = (component: DriveComponent, id: string, count: number) => {
    const current = customs[component];
    const options = [
      ...current.options.filter((option) => option !== id),
      ...Array.from({ length: Math.max(0, count) }, () => id),
    ];
    onChange({ ...customs, [component]: { ...current, options } });
  };
  const setTons = (component: "thrust" | "jump", tons: number | undefined) => {
    const current = { ...customs[component] };
    if (tons == null) delete current.effectiveTons;
    else current.effectiveTons = tons;
    onChange({ ...customs, [component]: current });
  };
  const tonnage = (component: "thrust" | "jump") => ({
    hullTons: design.hullTons,
    onChange: (tons: number | undefined) => setTons(component, tons),
  });
  return (
    <>
      <div className="drive-custom">
        <CustomColumn
          className="drive-column"
          title="Thrust"
          choices={DRIVE_OPTIONS.thrust}
          custom={customs.thrust}
          disabled={false}
          tonnage={tonnage("thrust")}
          onTier={(tier) => setTier("thrust", tier)}
          onSet={(id, count) => setCount("thrust", id, count)}
        />
        <CustomColumn
          className="drive-column"
          title="Jump"
          choices={DRIVE_OPTIONS.jump}
          custom={customs.jump}
          disabled={design.hullTons < JUMP_MIN_HULL_TONS || design.jump <= 0}
          tonnage={tonnage("jump")}
          onTier={(tier) => setTier("jump", tier)}
          onSet={(id, count) => setCount("jump", id, count)}
        />
        <CustomColumn
          className="drive-column"
          title="Power plant"
          choices={DRIVE_OPTIONS.plant}
          custom={customs.plant}
          disabled={design.power <= 0}
          onTier={(tier) => setTier("plant", tier)}
          onSet={(id, count) => setCount("plant", id, count)}
        />
      </div>
      <div className="row">
        <button type="button" onClick={onSave}>Save</button>
      </div>
    </>
  );
}

function ContainerField(
  { label, value, action, onChange }: {
    label: string;
    value: number;
    action: unknown;
    onChange: (value: number) => void;
  },
) {
  return (
    <label>
      <span className="container-title">
        {label}
        {action}
      </span>
      <input
        type="number"
        min={0}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  );
}

function ContainerFields(
  { draft, onChange }: {
    draft: AdvancedDesign;
    onChange: (next: Partial<AdvancedDesign>) => void;
  },
) {
  const extras = draft.extraContainers ?? [];
  return (
    <div
      className="fuel-containers"
      style={{ gridRow: `span ${extras.length + 1}` }}
    >
      <ContainerField
        label="Fuel/cargo container"
        value={draft.containerTons}
        onChange={(containerTons) => {
          if (!Number.isFinite(containerTons)) return;
          onChange({ containerTons: Math.max(0, Math.round(containerTons)) });
        }}
        action={
          <button
            type="button"
            className="container-toggle"
            aria-label="Add fuel/cargo container"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() =>
              onChange({
                extraContainers: [...extras, { id: freshId(), tons: 0 }],
              })}
          >
            +
          </button>
        }
      />
      {extras.map((row) => (
        <ContainerField
          key={row.id}
          label="Fuel/cargo container"
          value={row.tons}
          onChange={(tons) => {
            if (!Number.isFinite(tons)) return;
            onChange({
              extraContainers: extras.map((item) =>
                item.id === row.id
                  ? { ...item, tons: Math.max(0, Math.round(tons)) }
                  : item
              ),
            });
          }}
          action={
            <button
              type="button"
              className="container-toggle"
              aria-label="Remove fuel/cargo container"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() =>
                onChange({
                  extraContainers: extras.filter((item) => item.id !== row.id),
                })}
            >
              −
            </button>
          }
        />
      ))}
    </div>
  );
}

function driveValues(draft: AdvancedDesign, sheet: DesignSheet): string[] {
  const moduleDraft = draft.hullType === "module";
  const values: string[] = [];
  if (!moduleDraft) {
    const thrust = customNote("thrust", draft.driveCustom?.thrust);
    const jump = customNote("jump", draft.driveCustom?.jump);
    const plantNote = customNote("plant", draft.driveCustom?.plant);
    const plant = powerPlantsAt(draft.techLevel).find((row) =>
      row.id === draft.powerPlant
    )?.label ?? draft.powerPlant;
    const jumpRating = draft.hullTons < JUMP_MIN_HULL_TONS ? 0 : draft.jump;
    values.push(
      thrust ? `Thrust ${draft.thrust} (${thrust})` : `Thrust ${draft.thrust}`,
    );
    values.push(jump ? `Jump ${jumpRating} (${jump})` : `Jump ${jumpRating}`);
    values.push(plantNote ? `${plant} (${plantNote})` : plant);
    values.push(`${draft.power} power`);
    values.push(`${draft.powerWeeks} weeks`);
  }
  values.push(`Fuel ${tonLabel(Math.max(draft.fuelTons, sheet.fuelMinimum))}`);
  const containers = containerCapacities(draft).filter((tons) => tons > 0);
  if (containers.length === 1) {
    values.push(`Container ${tonLabel(containers[0])}`);
  } else if (containers.length > 1) {
    values.push(
      `Containers ${containers.map((tons) => tonLabel(tons)).join(", ")}`,
    );
  }
  if (draft.processorTons > 0) {
    values.push(`Processors ${tonLabel(draft.processorTons)}`);
  }
  if (!moduleDraft && draft.scoops) values.push("Fuel scoops");
  return values;
}

export function DrivesSection({ draft, sheet, onChange }: {
  draft: AdvancedDesign;
  sheet: DesignSheet;
  onChange: (next: Partial<AdvancedDesign>) => void;
}) {
  const [customizing, setCustomizing] = useState(false);
  const moduleDraft = draft.hullType === "module";
  return (
    <details className="panel">
      <summary>
        <SectionHeading
          title="Drives, Power, and Fuel"
          values={driveValues(draft, sheet)}
        />
      </summary>
      {customizing && !moduleDraft
        ? (
          <DriveCustomizer
            design={draft}
            onChange={(driveCustom) => onChange({ driveCustom })}
            onSave={() => setCustomizing(false)}
          />
        )
        : (
          <>
            <div className="drive-fields">
              {moduleDraft ? null : (
                <>
                  <NumberField
                    label={`Thrust (${sheet.powerUse.maneuver})`}
                    note={customNote("thrust", draft.driveCustom?.thrust)}
                    value={draft.thrust}
                    min={0}
                    max={11}
                    onChange={(thrust) => onChange({ thrust })}
                  />
                  <NumberField
                    label={`Jump (${sheet.powerUse.jump})`}
                    note={customNote("jump", draft.driveCustom?.jump)}
                    value={draft.hullTons < JUMP_MIN_HULL_TONS ? 0 : draft.jump}
                    min={0}
                    max={9}
                    readOnly={draft.hullTons < JUMP_MIN_HULL_TONS}
                    onChange={(jump) => onChange({ jump })}
                  />
                  <Choice
                    label="Power plant"
                    note={customNote("plant", draft.driveCustom?.plant)}
                    value={draft.powerPlant}
                    options={powerPlantsAt(draft.techLevel)}
                    onChange={(powerPlant) => onChange({ powerPlant })}
                  />
                  <NumberField
                    label={`Power points (${sheet.powerUse.total} required)`}
                    value={draft.power}
                    min={0}
                    onChange={(power) => onChange({ power })}
                  />
                  <NumberField
                    label="Power plant weeks"
                    value={draft.powerWeeks}
                    min={1}
                    max={52}
                    onChange={(powerWeeks) => onChange({ powerWeeks })}
                  />
                </>
              )}
              <NumberField
                label="Fuel tank"
                value={Math.max(draft.fuelTons, sheet.fuelMinimum)}
                min={sheet.fuelMinimum}
                step={draft.hullTons < 100 ? 0.01 : 1}
                onChange={(fuelTons) => {
                  if (!Number.isFinite(fuelTons)) return;
                  const tons = draft.hullTons < 100
                    ? Math.round(fuelTons * 100) / 100
                    : Math.round(fuelTons);
                  onChange({ fuelTons: Math.max(sheet.fuelMinimum, tons) });
                }}
              />
              <ContainerFields draft={draft} onChange={onChange} />
              <NumberField
                label="Fuel processor tons"
                value={draft.processorTons}
                min={0}
                onChange={(processorTons) => onChange({ processorTons })}
              />
              {moduleDraft ? null : (
                <Choice
                  label="Fuel scoops"
                  value={draft.scoops ? "yes" : "no"}
                  options={[{ id: "yes", label: "Yes" }, {
                    id: "no",
                    label: "No",
                  }]}
                  onChange={(value) => onChange({ scoops: value === "yes" })}
                />
              )}
            </div>
            {moduleDraft
              ? (
                <p className="meta">
                  Fuel capacity {tonLabel(sheet.fuelCapacity)}.
                </p>
              )
              : (
                <p className="meta">
                  This plant supplies {suppliedPower(draft, sheet)}{" "}
                  power points in {tonLabel(sheet.powerPlantTons)}. Jump fuel
                  {" "}
                  {tonLabel(sheet.jumpFuel)}. Power fuel{" "}
                  {tonLabel(sheet.powerFuel)}. Fuel capacity{" "}
                  {tonLabel(sheet.fuelCapacity)}. Effective thrust{" "}
                  {sheet.thrustRating}. Effective jump {sheet.jumpRating}.
                </p>
              )}
            {moduleDraft ? null : (
              <button
                type="button"
                onClick={() => setCustomizing(true)}
              >
                Customize
              </button>
            )}
          </>
        )}
    </details>
  );
}

import { useState } from "../../runtime.ts";
import type { AdvancedDesign, DesignSheet } from "../../design.ts";
import {
  blankDriveCustom,
  customLabel,
  type DriveCustom,
  legalCustomOptions,
} from "../../catalog/drives.ts";
import {
  exteriorAppearsUnarmed,
  hasAdjustableHull,
  MOUNT_KINDS,
  type MountKindId,
  mountKindsFor,
  type MountWeaponId,
  mountWeaponSlots,
  pointsUsed,
  POPUP_MOUNT,
  weaponChoices,
  weaponPoints,
  weaponsForMount,
} from "../../catalog/weapons.ts";
import { CustomColumn } from "./CustomColumn.tsx";
import { Choice, counted, freshId, SectionHeading } from "./shared.tsx";

function fittedWeapons(design: AdvancedDesign) {
  const rows: {
    mountId: string;
    index: number;
    weaponId: MountWeaponId;
    kind: MountKindId;
    label: string;
    custom: DriveCustom;
  }[] = [];
  for (const mount of design.mounts ?? []) {
    const slots = mountWeaponSlots(mount.kind, design.hullTons);
    mount.weapons.slice(0, slots).forEach((weaponId, index) => {
      const weapon = weaponsForMount(mount.kind).find((row) =>
        row.id === weaponId
      );
      if (!weapon) return;
      rows.push({
        mountId: mount.id,
        index,
        weaponId,
        kind: mount.kind,
        label: weapon.label,
        custom: mount.custom?.[index] ?? blankDriveCustom(),
      });
    });
  }
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.label, (counts.get(row.label) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return rows.map((row) => {
    const number = (seen.get(row.label) ?? 0) + 1;
    seen.set(row.label, number);
    const title = (counts.get(row.label) ?? 0) > 1
      ? `${row.label} ${number}`
      : row.label;
    return { ...row, title };
  });
}

function mountTitles(
  design: AdvancedDesign,
): { id: string; title: string; kind: MountKindId; popup: boolean }[] {
  const labels = design.mounts.map((mount) =>
    MOUNT_KINDS.find((row) => row.id === mount.kind)?.label ?? "Mount"
  );
  const totals = new Map<string, number>();
  for (const label of labels) totals.set(label, (totals.get(label) ?? 0) + 1);
  const seen = new Map<string, number>();
  return design.mounts.map((mount, index) => {
    const label = labels[index] ?? "Mount";
    const number = (seen.get(label) ?? 0) + 1;
    seen.set(label, number);
    const title = (totals.get(label) ?? 0) > 1 ? `${label} ${number}` : label;
    return {
      id: mount.id,
      title,
      kind: mount.kind,
      popup: mount.popup === true && mount.kind !== "barbette",
    };
  });
}

function WeaponCustomizer({ design, onChange, onPopup, onSave }: {
  design: AdvancedDesign;
  onChange: (mountId: string, index: number, custom: DriveCustom) => void;
  onPopup: (mountId: string, popup: boolean) => void;
  onSave: () => void;
}) {
  const columns = fittedWeapons(design);
  const mounts = mountTitles(design);
  const automaticPopup = hasAdjustableHull(design.hullOptions);
  return (
    <>
      <div className="weapon-custom">
        {mounts.map((mount) => (
          <div className="custom-column" key={mount.id}>
            <h3>{mount.title}</h3>
            {mount.kind === "barbette"
              ? (
                <p className="meta">
                  Five tons and one weapon. One hardpoint, or three firmpoints.
                </p>
              )
              : null}
            {automaticPopup
              ? (
                <>
                  <div className="custom-list">
                    <label className="check">
                      <input
                        type="checkbox"
                        checked
                        disabled
                        onChange={() => undefined}
                      />
                      Pop-up mounting
                    </label>
                  </div>
                  <p className="meta">
                    Included with the adjustable hull. No extra tonnage or cost.
                  </p>
                </>
              )
              : mount.kind === "barbette"
              ? null
              : (
                <>
                  <div className="custom-list">
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={mount.popup}
                        onChange={(event) =>
                          onPopup(mount.id, event.currentTarget.checked)}
                      />
                      Pop-up mounting
                    </label>
                  </div>
                  <p className="meta">
                    Tech level {POPUP_MOUNT.tl}. +{POPUP_MOUNT.tons} ton and MCr
                    {" "}
                    {POPUP_MOUNT.cost}.
                  </p>
                </>
              )}
          </div>
        ))}
      </div>
      {columns.length > 0
        ? (
          <div className="weapon-custom">
            {columns.map((column) => {
              const choices = weaponChoices(column.weaponId, column.kind);
              return (
                <CustomColumn
                  key={`${column.mountId}-${column.index}`}
                  className="custom-column"
                  title={column.title}
                  choices={choices}
                  custom={column.custom}
                  disabled={false}
                  onTier={(tier) => {
                    const next = { ...column.custom, tier };
                    onChange(column.mountId, column.index, {
                      tier,
                      options: legalCustomOptions(choices, next).map((option) =>
                        option.id
                      ),
                    });
                  }}
                  onSet={(id, count) => {
                    const options = [
                      ...column.custom.options.filter((option) =>
                        option !== id
                      ),
                      ...Array.from({ length: Math.max(0, count) }, () => id),
                    ];
                    onChange(column.mountId, column.index, {
                      ...column.custom,
                      options,
                    });
                  }}
                />
              );
            })}
          </div>
        )
        : null}
      <div className="row">
        <button type="button" onClick={onSave}>Save</button>
      </div>
    </>
  );
}

function weaponValues(draft: AdvancedDesign): string[] {
  if (draft.mounts.length === 0) return ["No weapons"];
  return draft.mounts.map((mount) => {
    const kind = MOUNT_KINDS.find((row) => row.id === mount.kind)?.label ??
      "Mount";
    const labels = mount.weapons.map((id) =>
      weaponsForMount(mount.kind).find((row) => row.id === id)?.label ?? id
    );
    const counts = new Map<string, number>();
    for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
    const fitted = [...counts].map(([label, count]) => counted(label, count))
      .join(", ");
    const popup = mount.popup && mount.kind !== "barbette" ? " pop-up" : "";
    return `${kind}${popup} (${fitted || "empty"})`;
  });
}

export function WeaponsSection({ draft, sheet, onChange }: {
  draft: AdvancedDesign;
  sheet: DesignSheet;
  onChange: (next: Partial<AdvancedDesign>) => void;
}) {
  const [customizingWeapons, setCustomizingWeapons] = useState(false);
  return (
    <details className="panel">
      <summary>
        <SectionHeading title="Weapons" values={weaponValues(draft)} />
      </summary>
      {exteriorAppearsUnarmed(
          draft.mounts,
          draft.hullTons,
          hasAdjustableHull(draft.hullOptions),
        )
        ? (
          <p className="meta">
            An exterior sensor scan treats this ship as unarmed.
          </p>
        )
        : null}
      {customizingWeapons && draft.mounts.length > 0
        ? (
          <WeaponCustomizer
            design={draft}
            onChange={(mountId, index, custom) =>
              onChange({
                mounts: draft.mounts.map((mount) => {
                  if (mount.id !== mountId) return mount;
                  const next = mount.weapons.map((_, slot) =>
                    mount.custom?.[slot] ?? blankDriveCustom()
                  );
                  next[index] = custom;
                  return { ...mount, custom: next };
                }),
              })}
            onPopup={(mountId, popup) =>
              onChange({
                mounts: draft.mounts.map((mount) => {
                  if (mount.id !== mountId) return mount;
                  if (!popup) {
                    const { popup: _popup, ...rest } = mount;
                    return rest;
                  }
                  return { ...mount, popup: true };
                }),
              })}
            onSave={() => setCustomizingWeapons(false)}
          />
        )
        : (
          <>
            <p className="meta">
              {weaponPoints(draft.hullTons).label} {sheet.hardpointsUsed} /{" "}
              {sheet.hardpoints}.{draft.hullTons < 100
                ? " One firmpoint may be a single turret. A barbette uses three firmpoints. Any other firmpoint is a fixed mount. Weapon power is 25% lower, rounded up."
                : ""}
            </p>
            {draft.mounts.map((mount) => {
              const kind = MOUNT_KINDS.find((row) => row.id === mount.kind) ??
                MOUNT_KINDS[0];
              const slots = mountWeaponSlots(mount.kind, draft.hullTons);
              const kinds = mountKindsFor(
                draft.hullTons,
                draft.mounts,
                mount.id,
              );
              const catalog = weaponsForMount(mount.kind);
              const available = catalog.filter((weapon) =>
                weapon.tl <= draft.techLevel
              );
              return (
                <div className="weapon-mount" key={mount.id}>
                  <div className="row">
                    <Choice
                      label="Mount"
                      value={mount.kind}
                      options={kinds.some((row) => row.id === mount.kind)
                        ? kinds
                        : [kind, ...kinds]}
                      onChange={(value) => {
                        const next = MOUNT_KINDS.find((row) =>
                          row.id === value
                        ) ?? kind;
                        const nextSlots = mountWeaponSlots(
                          next.id,
                          draft.hullTons,
                        );
                        const allowed = new Set(
                          weaponsForMount(next.id).map((weapon) => weapon.id),
                        );
                        onChange({
                          mounts: draft.mounts.map((item) => {
                            if (item.id !== mount.id) return item;
                            const pairs = item.weapons.map((id, index) => ({
                              id,
                              custom: item.custom?.[index],
                            })).filter((pair) => allowed.has(pair.id)).slice(
                              0,
                              nextSlots,
                            );
                            const weapons = pairs.map((pair) => pair.id);
                            const custom = pairs.some((pair) => pair.custom)
                              ? pairs.map((pair) =>
                                pair.custom ?? blankDriveCustom()
                              )
                              : undefined;
                            const { popup: _popup, custom: _custom, ...rest } =
                              item;
                            return {
                              ...rest,
                              kind: next.id as MountKindId,
                              weapons,
                              ...(custom ? { custom } : {}),
                              ...(next.id !== "barbette" && item.popup
                                ? { popup: true }
                                : {}),
                            };
                          }),
                        });
                      }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          mounts: draft.mounts.filter((item) =>
                            item.id !== mount.id
                          ),
                        })}
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      disabled={mount.weapons.length >= slots ||
                        available.length === 0}
                      onClick={() => {
                        const next = available[0];
                        if (!next) return;
                        onChange({
                          mounts: draft.mounts.map((item) =>
                            item.id === mount.id
                              ? { ...item, weapons: [...item.weapons, next.id] }
                              : item
                          ),
                        });
                      }}
                    >
                      Add weapon
                    </button>
                  </div>
                  {mount.weapons.map((weapon, index) => (
                    <div className="row" key={`${mount.id}-${index}`}>
                      <Choice
                        label={`Weapon ${index + 1}`}
                        note={customLabel(
                          weaponChoices(weapon, mount.kind),
                          mount.custom?.[index],
                        )}
                        value={weapon}
                        options={catalog.filter((row) =>
                          row.tl <= draft.techLevel || row.id === weapon
                        )}
                        onChange={(value) => {
                          const weapons = mount.weapons.slice();
                          weapons[index] = value as MountWeaponId;
                          onChange({
                            mounts: draft.mounts.map((item) =>
                              item.id === mount.id ? { ...item, weapons } : item
                            ),
                          });
                        }}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          onChange({
                            mounts: draft.mounts.map((item) =>
                              item.id === mount.id
                                ? {
                                  ...item,
                                  weapons: item.weapons.filter((_, slot) =>
                                    slot !== index
                                  ),
                                  custom: item.custom?.filter((_, slot) =>
                                    slot !== index
                                  ),
                                }
                                : item
                            ),
                          })}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
            <button
              type="button"
              disabled={pointsUsed(draft.mounts, draft.hullTons) >=
                  sheet.hardpoints ||
                mountKindsFor(draft.hullTons, draft.mounts).length === 0}
              onClick={() => {
                const kind = mountKindsFor(draft.hullTons, draft.mounts)[0];
                if (!kind) return;
                onChange({
                  mounts: [...draft.mounts, {
                    id: freshId(),
                    kind: kind.id,
                    weapons: [],
                  }],
                });
              }}
            >
              Add turret
            </button>
            {draft.mounts.length > 0
              ? (
                <button
                  type="button"
                  onClick={() => setCustomizingWeapons(true)}
                >
                  Customize
                </button>
              )
              : null}
          </>
        )}
    </details>
  );
}

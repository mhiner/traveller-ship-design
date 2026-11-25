import { useEffect, useState } from "../../runtime.ts";
import { type AdvancedDesign, legalMounts } from "../../design.ts";
import {
  ARMOUR,
  armourAt,
  armourRatingMax,
  CONFIGURATIONS,
  HULL_OPTIONS,
  HULL_TYPES,
  type HullOption,
  type HullOptionId,
  hullOptionsAt,
  hullOptionTons,
  MAX_HULL_TONS,
  MIN_HULL_TONS,
  moduleFitsBay,
  modularHullMaxTons,
  PRESSURE_HULL_ARMOUR,
  solarCoatingMaxUnits,
} from "../../catalog/hull.ts";
import { bridgesAt } from "../../catalog/bridge.ts";
import { JUMP_MIN_HULL_TONS } from "../../catalog/drives.ts";
import { NumberField } from "../fields.tsx";
import {
  Choice,
  counted,
  freshId,
  SectionHeading,
  tonLabel,
} from "./shared.tsx";

function HullOptions(
  { options, hullTons, techLevel, catalog, draftId, hulls, onChange, onHulls }:
    {
      options: HullOption[];
      hullTons: number;
      techLevel: number;
      catalog: readonly AdvancedDesign[];
      draftId: string;
      hulls: string[];
      onChange: (options: HullOption[]) => void;
      onHulls: (hulls: string[]) => void;
    },
) {
  const [pick, setPick] = useState("");
  const [hullPick, setHullPick] = useState("");
  const [modulePicks, setModulePicks] = useState<Record<string, string>>({});
  const available = hullOptionsAt(
    techLevel,
    options.map((option) => option.kind),
  );
  const choice = available.some((option) => option.id === pick)
    ? pick
    : available[0]?.id ?? "";
  const candidates = catalog.filter((design) => {
    if (design.id === draftId) return false;
    const joined = design.breakawayHulls ?? [];
    return design.hullOptions.some((option) => option.kind === "breakaway") &&
      joined.length === 0;
  });
  const hullChoice = candidates.some((design) => design.id === hullPick)
    ? hullPick
    : candidates[0]?.id ?? "";
  return (
    <details className="panel">
      <summary>Hull options</summary>
      <table>
        <thead>
          <tr>
            <th>Option</th>
            <th>Tons</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {options.map((option) => {
            const kind = HULL_OPTIONS.find((row) => row.id === option.kind);
            const modular = option.kind === "modular";
            const solar = option.kind === "solarEnhanced" ||
              option.kind === "solarAdvanced";
            const maxUnits = solarCoatingMaxUnits(hullTons);
            const otherModularTons = options.reduce((total, item) =>
              item.kind === "modular" && item.id !== option.id
                ? total + (item.tons ?? 0)
                : total, 0);
            const maxTons = Math.max(
              0,
              Math.round(
                (modularHullMaxTons(hullTons) - otherModularTons) * 100,
              ) / 100,
            );
            const allocated = Math.min(option.tons ?? 0, maxTons);
            const fitted = option.modules ?? [];
            const moduleCandidates = fitted.length > 0 ? [] : catalog.filter((
              design,
            ) =>
              design.hullType === "module" && design.id !== draftId &&
              design.techLevel <= techLevel &&
              moduleFitsBay(design.hullTons, allocated)
            );
            const modulePick = modulePicks[option.id] ?? "";
            const moduleChoice = moduleCandidates.some((design) =>
                design.id === modulePick
              )
              ? modulePick
              : moduleCandidates[0]?.id ?? "";
            return (
              <>
                <tr key={option.id}>
                  <td>{kind?.label ?? option.kind}</td>
                  <td>
                    {modular
                      ? (
                        <NumberField
                          label="Allocated"
                          value={option.tons ?? 0}
                          min={0}
                          max={maxTons}
                          step={0.01}
                          onChange={(value) => {
                            const tons = Math.min(
                              maxTons,
                              Math.max(
                                0,
                                Math.round(
                                  (Number.isFinite(value) ? value : 0) * 100,
                                ) / 100,
                              ),
                            );
                            onChange(
                              options.map((item) =>
                                item.id === option.id ? { ...item, tons } : item
                              ),
                            );
                          }}
                        />
                      )
                      : solar
                      ? (
                        <NumberField
                          label="Units"
                          value={option.units ?? 0}
                          min={0}
                          max={maxUnits}
                          step={1}
                          onChange={(value) => {
                            const units = Math.min(
                              maxUnits,
                              Math.max(
                                0,
                                Math.trunc(Number.isFinite(value) ? value : 0),
                              ),
                            );
                            onChange(
                              options.map((item) =>
                                item.id === option.id
                                  ? { ...item, units }
                                  : item
                              ),
                            );
                          }}
                        />
                      )
                      : tonLabel(hullOptionTons(option.kind, hullTons))}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        onChange(
                          options.filter((item) => item.id !== option.id),
                        )}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
                {modular
                  ? (
                    <tr key={`${option.id}-modules`}>
                      <td colSpan={3}>
                        <details className="panel">
                          <summary>Modules</summary>
                          <p className="meta">
                            This bay holds one module of {tonLabel(allocated)}.
                            The module must be that size and within this ship's
                            tech level.
                          </p>
                          {fitted.length === 0
                            ? <p className="meta">No modules added.</p>
                            : null}
                          {fitted.map((id) => {
                            const design = catalog.find((row) => row.id === id);
                            return (
                              <div className="row" key={id}>
                                <span>
                                  {design
                                    ? `${design.name} · ${
                                      tonLabel(design.hullTons)
                                    } · TL${design.techLevel}`
                                    : "Missing module"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onChange(options.map((item) =>
                                      item.id === option.id
                                        ? {
                                          ...item,
                                          modules: fitted.filter((moduleId) =>
                                            moduleId !== id
                                          ),
                                        }
                                        : item
                                    ))}
                                >
                                  Remove
                                </button>
                              </div>
                            );
                          })}
                          <div className="row">
                            <select
                              aria-label="Add module"
                              value={moduleChoice}
                              disabled={moduleCandidates.length === 0}
                              onChange={(event) =>
                                setModulePicks((picks) => ({
                                  ...picks,
                                  [option.id]: event.currentTarget.value,
                                }))}
                            >
                              {moduleCandidates.map((design) => (
                                <option key={design.id} value={design.id}>
                                  {design.name} · {tonLabel(design.hullTons)}
                                  {" "}
                                  · TL{design.techLevel}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={!moduleChoice}
                              onClick={() =>
                                onChange(options.map((item) =>
                                  item.id === option.id
                                    ? {
                                      ...item,
                                      modules: [...fitted, moduleChoice],
                                    }
                                    : item
                                ))}
                            >
                              Add
                            </button>
                          </div>
                        </details>
                      </td>
                    </tr>
                  )
                  : null}
                {option.kind === "breakaway"
                  ? (
                    <tr key={`${option.id}-hulls`}>
                      <td colSpan={3}>
                        <details className="panel">
                          <summary>Breakaway hulls</summary>
                          <p className="meta">
                            Designs with a breakaway hull and no hulls of their
                            own can join this ship. The same design can be added
                            more than once. (change view) on the sheet switches
                            between each hull and the combined hull.
                          </p>
                          {hulls.length === 0
                            ? <p className="meta">No hulls added.</p>
                            : null}
                          {hulls.map((id, index) => {
                            const design = catalog.find((row) => row.id === id);
                            return (
                              <div className="row" key={`${id}-${index}`}>
                                <span>{design?.name ?? "Missing design"}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onHulls(
                                      hulls.filter((_, item) => item !== index),
                                    )}
                                >
                                  Remove
                                </button>
                              </div>
                            );
                          })}
                          <div className="row">
                            <select
                              aria-label="Add breakaway hull"
                              value={hullChoice}
                              disabled={candidates.length === 0}
                              onChange={(event) =>
                                setHullPick(event.currentTarget.value)}
                            >
                              {candidates.map((design) => (
                                <option key={design.id} value={design.id}>
                                  {design.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={!hullChoice}
                              onClick={() => onHulls([...hulls, hullChoice])}
                            >
                              Add
                            </button>
                          </div>
                        </details>
                      </td>
                    </tr>
                  )
                  : null}
              </>
            );
          })}
        </tbody>
      </table>
      <div className="row">
        <select
          aria-label="Add hull option"
          value={choice}
          disabled={available.length === 0}
          onChange={(event) => setPick(event.currentTarget.value)}
        >
          {available.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!choice}
          onClick={() => {
            const kind = choice as HullOptionId;
            const added: HullOption = kind === "modular"
              ? { id: freshId(), kind, tons: 0, modules: [] }
              : kind === "solarEnhanced" || kind === "solarAdvanced"
              ? {
                id: freshId(),
                kind,
                units: Math.min(1, solarCoatingMaxUnits(hullTons)),
              }
              : { id: freshId(), kind };
            onChange([...options, added]);
          }}
        >
          Add
        </button>
      </div>
      {options.some((option) => option.kind === "pressure")
        ? (
          <p className="meta">
            25% of the hull. Costs ten times the hull and adds Armour 4.
          </p>
        )
        : null}
      {options.some((option) => option.kind === "adjustable")
        ? (
          <p className="meta">
            5% of the hull and 10% of the base hull cost. Every weapon has
            pop-up mounting at no extra tonnage or cost.
          </p>
        )
        : null}
      {options.some((option) => option.kind === "adjustable15")
        ? (
          <p className="meta">
            1% of the hull and the full base hull cost. Every weapon has pop-up
            mounting at no extra tonnage or cost.
          </p>
        )
        : null}
      {options.some((option) => option.kind === "grav")
        ? (
          <p className="meta">
            1 ton per 200 tons of hull. MCr 1 and 2 power per ton of screen.
          </p>
        )
        : null}
    </details>
  );
}

function hullValues(
  draft: AdvancedDesign,
  catalog: readonly AdvancedDesign[],
  armourRating: number,
): string[] {
  const configuration =
    CONFIGURATIONS.find((row) => row.id === draft.configuration)?.label ??
      draft.configuration;
  const hullType = HULL_TYPES.find((row) => row.id === draft.hullType)?.label ??
    draft.hullType;
  const values = [`${draft.hullTons} t`, configuration, hullType];
  if (draft.hullType !== "module") {
    const armour = ARMOUR.find((row) => row.id === draft.armour);
    values.push(
      !armour || armour.id === "none"
        ? "No armour"
        : `${armour.label} ${armourRating}`,
    );
  }
  const breakaway = draft.breakawayHulls ?? [];
  for (const option of draft.hullOptions) {
    const kind = HULL_OPTIONS.find((row) => row.id === option.kind);
    const label = kind?.label ?? option.kind;
    if (option.kind === "modular") {
      const names = (option.modules ?? []).map((id) =>
        catalog.find((row) => row.id === id)?.name ?? "Missing module"
      );
      const counts = new Map<string, number>();
      for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
      const fitted = [...counts].map(([name, count]) => counted(name, count))
        .join(", ");
      values.push(
        fitted
          ? `${label} ${tonLabel(option.tons ?? 0)} (${fitted})`
          : `${label} ${tonLabel(option.tons ?? 0)}`,
      );
    } else if (option.kind === "breakaway") {
      const names = breakaway.map((id) =>
        catalog.find((row) => row.id === id)?.name ?? "Missing design"
      );
      const counts = new Map<string, number>();
      for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
      const fitted = [...counts].map(([name, count]) => counted(name, count))
        .join(", ");
      values.push(fitted ? `${label} (${fitted})` : label);
    } else if (
      option.kind === "solarEnhanced" || option.kind === "solarAdvanced"
    ) {
      values.push(counted(label, option.units ?? 0));
    } else {
      values.push(label);
    }
  }
  return values;
}

export function HullSection({ draft, catalog, onChange }: {
  draft: AdvancedDesign;
  catalog: readonly AdvancedDesign[];
  onChange: (next: Partial<AdvancedDesign>) => void;
}) {
  const moduleDraft = draft.hullType === "module";
  const priorArmour =
    (CONFIGURATIONS.find((row) => row.id === draft.configuration)
      ?.armourBonus ?? 0) +
    (draft.hullOptions.some((option) => option.kind === "pressure")
      ? PRESSURE_HULL_ARMOUR
      : 0);
  const armourMax = armourRatingMax(draft.armour, draft.techLevel, priorArmour);
  useEffect(() => {
    if (draft.armourRating > armourMax) onChange({ armourRating: armourMax });
  }, [armourMax, draft.armourRating]);
  return (
    <details className="panel">
      <summary>
        <SectionHeading
          title="Hull"
          values={hullValues(
            draft,
            catalog,
            Math.min(draft.armourRating, armourMax),
          )}
        />
      </summary>
      <div className="grid">
        <NumberField
          label="Tonnage"
          value={draft.hullTons}
          min={MIN_HULL_TONS}
          max={MAX_HULL_TONS}
          onChange={(value) => {
            if (!Number.isFinite(value)) return;
            const hullTons = Math.max(0, Math.round(value));
            if (hullTons < MIN_HULL_TONS || hullTons > MAX_HULL_TONS) {
              onChange({ hullTons });
              return;
            }
            const allowed = bridgesAt(hullTons);
            const bridge = allowed.some((item) => item.id === draft.bridge)
              ? draft.bridge
              : "bridge";
            const jump = hullTons < JUMP_MIN_HULL_TONS ? 0 : draft.jump;
            onChange({
              hullTons,
              bridge,
              jump,
              mounts: legalMounts(hullTons, draft.mounts),
            });
          }}
        />
        <Choice
          label="Configuration"
          value={draft.configuration}
          options={CONFIGURATIONS}
          onChange={(configuration) => onChange({ configuration })}
        />
        <Choice
          label="Hull Type"
          value={draft.hullType}
          options={HULL_TYPES}
          onChange={(hullType) =>
            onChange(
              hullType === "module"
                ? { hullType, classification: "Other" }
                : { hullType },
            )}
        />
      </div>
      {moduleDraft ? null : (
        <div className="grid">
          <Choice
            label="Armour"
            value={draft.armour}
            options={armourAt(draft.techLevel)}
            onChange={(armour) => onChange({ armour })}
          />
          <NumberField
            label="Rating"
            value={Math.min(draft.armourRating, armourMax)}
            min={0}
            max={armourMax}
            onChange={(armourRating) =>
              onChange({
                armourRating: Math.min(armourMax, Math.max(0, armourRating)),
              })}
          />
        </div>
      )}
      {moduleDraft ? null : (
        <HullOptions
          options={draft.hullOptions}
          hullTons={draft.hullTons}
          techLevel={draft.techLevel}
          catalog={catalog}
          draftId={draft.id}
          hulls={draft.breakawayHulls ?? []}
          onChange={(hullOptions) =>
            onChange(
              hullOptions.some((option) => option.kind === "breakaway")
                ? { hullOptions }
                : { hullOptions, breakawayHulls: [] },
            )}
          onHulls={(breakawayHulls) => onChange({ breakawayHulls })}
        />
      )}
    </details>
  );
}

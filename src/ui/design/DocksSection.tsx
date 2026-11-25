import { useState } from "../../runtime.ts";
import {
  type AdvancedDesign,
  type DesignSheet,
  type Dock,
} from "../../design.ts";
import {
  CARGO_GEAR,
  CARGO_NET_RULE,
  CARGO_SCOOP_NOTE,
  type CargoGear,
  type CargoGearId,
  DOCK_VEHICLES,
  dockingSpaceTons,
  EMPTY_DOCK_CRAFT,
  DRONE_SET_SIZE,
  type DroneFit,
  type DroneId,
  DRONES,
  PLANETARY_JUMP_NET_RULE,
  repairDroneTons,
} from "../../catalog/fittings.ts";
import { counted, freshId, SectionHeading, tonLabel } from "./shared.tsx";

function carriesCraft(
  design: AdvancedDesign,
  targetId: string,
  catalog: readonly AdvancedDesign[],
  seen = new Set<string>(),
): boolean {
  if (!targetId || seen.has(design.id)) return false;
  seen.add(design.id);
  for (const dock of design.docks ?? []) {
    if (dock.craft === targetId) return true;
    const nested = catalog.find((row) => row.id === dock.craft);
    if (nested && carriesCraft(nested, targetId, catalog, seen)) return true;
  }
  return false;
}

function DockingSpaces({ docks, catalog, draftId, cargo, onChange }: {
  docks: Dock[];
  catalog: readonly AdvancedDesign[];
  draftId: string;
  cargo: number;
  onChange: (docks: Dock[]) => void;
}) {
  return (
    <details className="panel">
      <summary>Docking spaces</summary>
      <table>
        <thead>
          <tr>
            <th>Craft</th>
            <th>Dock tons</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {docks.map((dock) => {
            const empty = dock.craft === EMPTY_DOCK_CRAFT;
            const vehicle = DOCK_VEHICLES.find((row) => row.id === dock.craft);
            const selected = catalog.find((row) => row.id === dock.craft);
            const stowed = Boolean(dock.stowed) && Boolean(vehicle);
            const sized = empty
              ? Math.max(0, dock.craftTons ?? 0)
              : vehicle?.tons ?? selected?.hullTons;
            const bayTons = stowed || sized == null || sized <= 0
              ? 0
              : dockingSpaceTons(sized);
            const room = cargo + bayTons;
            const ships = catalog
              .filter((ship) =>
                ship.id && ship.id !== draftId &&
                !carriesCraft(ship, draftId, catalog)
              )
              .filter((ship) =>
                ship.id === dock.craft ||
                dockingSpaceTons(ship.hullTons) <= room + 0.001
              )
              .sort((a, b) =>
                a.hullTons - b.hullTons || a.name.localeCompare(b.name)
              );
            const known = empty || Boolean(vehicle) ||
              ships.some((ship) => ship.id === dock.craft);
            return (
              <tr key={dock.id}>
                <td>
                  <select
                    aria-label="Docked craft"
                    value={dock.craft}
                    onChange={(event) => {
                      const craft = event.currentTarget.value;
                      onChange(docks.map((item) => {
                        if (item.id !== dock.id) return item;
                        if (craft !== EMPTY_DOCK_CRAFT) {
                          return { ...item, craft, craftTons: undefined };
                        }
                        return {
                          ...item,
                          craft,
                          craftTons: item.craftTons && item.craftTons > 0
                            ? item.craftTons
                            : 10,
                          stowed: undefined,
                          clamp: undefined,
                        };
                      }));
                    }}
                  >
                    <option value={EMPTY_DOCK_CRAFT}>Empty</option>
                    <optgroup label="Vehicles">
                      {DOCK_VEHICLES.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.label} ({row.tons} t)
                        </option>
                      ))}
                    </optgroup>
                    {ships.length > 0
                      ? (
                        <optgroup label="Ships">
                          {ships.map((ship) => (
                            <option key={ship.id} value={ship.id}>
                              {ship.name} ({ship.hullTons} t)
                            </option>
                          ))}
                        </optgroup>
                      )
                      : null}
                    {known
                      ? null
                      : <option value={dock.craft}>Missing ship</option>}
                  </select>
                  {empty
                    ? (
                      <label>
                        Craft tons
                        <input
                          type="number"
                          min={1}
                          step={1}
                          aria-label="Supported craft tons"
                          value={dock.craftTons ?? 0}
                          onChange={(event) => {
                            const craftTons = Math.max(
                              0,
                              Math.round(Number(event.currentTarget.value)),
                            );
                            if (!Number.isFinite(craftTons)) return;
                            onChange(docks.map((item) =>
                              item.id === dock.id
                                ? { ...item, craftTons }
                                : item
                            ));
                          }}
                        />
                      </label>
                    )
                    : null}
                </td>
                <td>
                  {stowed
                    ? "aboard"
                    : sized == null || sized <= 0
                    ? "—"
                    : tonLabel(bayTons)}
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() =>
                      onChange(docks.filter((item) => item.id !== dock.id))}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button
        type="button"
        onClick={() =>
          onChange([...docks, { id: freshId(), craft: "air-raft" }])}
      >
        Add docking space
      </button>
    </details>
  );
}

function Drones({ fits, hullTons, onChange }: {
  fits: DroneFit[];
  hullTons: number;
  onChange: (fits: DroneFit[]) => void;
}) {
  const [pick, setPick] = useState("");
  const taken = new Set(fits.map((fit) => fit.kind));
  const available = DRONES.filter((drone) => !taken.has(drone.id));
  const choice = available.some((drone) => drone.id === pick)
    ? pick
    : available[0]?.id ?? "";
  return (
    <details className="panel">
      <summary>Drones</summary>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Sets</th>
            <th>Tons</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {fits.map((fit) => {
            const kind = DRONES.find((row) => row.id === fit.kind);
            const repair = fit.kind === "repair";
            const tons = repair
              ? repairDroneTons(hullTons)
              : (kind?.tons ?? 0) * fit.quantity;
            return (
              <tr key={fit.id}>
                <td>{kind?.label ?? fit.kind}</td>
                <td>
                  {repair ? "—" : (
                    <input
                      type="number"
                      min={1}
                      aria-label={`${kind?.label ?? "Drone"} sets`}
                      value={fit.quantity}
                      onChange={(event) => {
                        const quantity = Math.max(
                          1,
                          Math.round(Number(event.currentTarget.value)),
                        );
                        if (!Number.isFinite(quantity)) return;
                        onChange(fits.map((item) =>
                          item.id === fit.id ? { ...item, quantity } : item
                        ));
                      }}
                    />
                  )}
                </td>
                <td>
                  {repair
                    ? tonLabel(tons)
                    : `${tonLabel(tons)} · ${
                      fit.quantity * DRONE_SET_SIZE
                    } drones`}
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() =>
                      onChange(fits.filter((item) =>
                        item.id !== fit.id
                      ))}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="row">
        <select
          aria-label="Add drones"
          value={choice}
          disabled={available.length === 0}
          onChange={(event) => setPick(event.currentTarget.value)}
        >
          {available.map((drone) => (
            <option key={drone.id} value={drone.id}>{drone.label}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!choice}
          onClick={() =>
            onChange([...fits, {
              id: freshId(),
              kind: choice as DroneId,
              quantity: 1,
            }])}
        >
          Add
        </button>
      </div>
    </details>
  );
}

function CargoSystems({ gear, sheet, onChange }: {
  gear: CargoGear[];
  sheet: DesignSheet;
  onChange: (gear: CargoGear[]) => void;
}) {
  const [pick, setPick] = useState("");
  const taken = new Set(gear.map((item) => item.kind));
  const available = CARGO_GEAR.filter((item) => !taken.has(item.id));
  const choice = available.some((item) => item.id === pick)
    ? pick
    : available[0]?.id ?? "";
  const lineTons = (name: string) =>
    sheet.lines.find((line) => line.name === name)?.tons;
  return (
    <details className="panel">
      <summary>Cargo</summary>
      <table>
        <thead>
          <tr>
            <th>System</th>
            <th>Amount</th>
            <th>Tons</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {gear.map((item) => {
            const kind = CARGO_GEAR.find((row) => row.id === item.kind);
            const net = item.kind === "jumpNet" || item.kind === "planetaryNet";
            const counted = item.kind === "belt" || item.kind === "belt12" ||
              item.kind === "external" || net;
            const belt = item.kind === "belt" || item.kind === "belt12";
            const tons = item.kind === "crane"
              ? lineTons("Cargo crane")
              : net
              ? lineTons(kind?.label ?? "")
              : item.kind === "external"
              ? item.quantity
              : belt
              ? kind?.tons ?? 0
              : (kind?.tons ?? 0) * item.quantity;
            return (
              <tr key={item.id}>
                <td>{kind?.label ?? item.kind}</td>
                <td>
                  {counted
                    ? (
                      <input
                        type="number"
                        min={1}
                        aria-label={item.kind === "external"
                          ? "External cargo mount tons"
                          : item.kind === "jumpNet" ||
                              item.kind === "planetaryNet"
                          ? "Jump net capacity"
                          : `${kind?.label ?? "Loading belt"} quantity`}
                        value={item.quantity}
                        onChange={(event) => {
                          const quantity = Math.max(
                            1,
                            Math.round(Number(event.currentTarget.value)),
                          );
                          if (!Number.isFinite(quantity)) return;
                          onChange(
                            gear.map((row) =>
                              row.id === item.id ? { ...row, quantity } : row
                            ),
                          );
                        }}
                      />
                    )
                    : "—"}
                </td>
                <td>
                  {tons == null
                    ? "—"
                    : item.kind === "external"
                    ? `${tonLabel(tons)} external`
                    : tonLabel(tons)}
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() =>
                      onChange(gear.filter((row) => row.id !== item.id))}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="row">
        <select
          aria-label="Add cargo system"
          value={choice}
          disabled={available.length === 0}
          onChange={(event) => setPick(event.currentTarget.value)}
        >
          {available.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!choice}
          onClick={() =>
            onChange([...gear, {
              id: freshId(),
              kind: choice as CargoGearId,
              quantity: choice === "jumpNet" || choice === "planetaryNet"
                ? 100
                : 1,
            }])}
        >
          Add
        </button>
      </div>
      {gear.some((item) => item.kind === "planetaryNet")
        ? <p className="meta">{PLANETARY_JUMP_NET_RULE}</p>
        : null}
      {gear.some((item) => item.kind === "cargoNet")
        ? <p className="meta">{CARGO_NET_RULE}</p>
        : null}
      {gear.some((item) => item.kind === "cargoScoop")
        ? <p className="meta">{CARGO_SCOOP_NOTE}</p>
        : null}
    </details>
  );
}

function dockValues(
  draft: AdvancedDesign,
  catalog: readonly AdvancedDesign[],
): string[] {
  const values: string[] = [];
  for (const dock of draft.docks) {
    const vehicle = DOCK_VEHICLES.find((row) => row.id === dock.craft);
    const ship = catalog.find((row) => row.id === dock.craft);
    const name = vehicle?.label ?? ship?.name ?? "Missing ship";
    values.push(
      dock.clamp
        ? `Docking clamp (${name})`
        : dock.stowed
        ? `${name} aboard`
        : name,
    );
  }
  for (const fit of draft.drones) {
    const label = DRONES.find((row) => row.id === fit.kind)?.label ?? fit.kind;
    values.push(fit.kind === "repair" ? label : counted(label, fit.quantity));
  }
  for (const item of draft.cargoGear) {
    const label = CARGO_GEAR.find((row) => row.id === item.kind)?.label ??
      item.kind;
    values.push(
      item.kind === "external" || item.kind === "jumpNet" ||
        item.kind === "planetaryNet"
        ? `${label} ${tonLabel(item.quantity)}`
        : counted(label, item.quantity),
    );
  }
  return values;
}

export function DocksSection({ draft, catalog, sheet, onChange }: {
  draft: AdvancedDesign;
  catalog: readonly AdvancedDesign[];
  sheet: DesignSheet;
  onChange: (next: Partial<AdvancedDesign>) => void;
}) {
  return (
    <details className="panel">
      <summary>
        <SectionHeading
          title="Docks and Drones"
          values={dockValues(draft, catalog)}
        />
      </summary>
      <DockingSpaces
        docks={draft.docks}
        catalog={catalog}
        draftId={draft.id}
        cargo={sheet.cargo}
        onChange={(docks) => onChange({ docks })}
      />
      <Drones
        fits={draft.drones}
        hullTons={draft.hullTons}
        onChange={(drones) => onChange({ drones })}
      />
      <CargoSystems
        gear={draft.cargoGear}
        sheet={sheet}
        onChange={(cargoGear) => onChange({ cargoGear })}
      />
    </details>
  );
}

import { useState } from "../../runtime.ts";
import type { AdvancedDesign } from "../../design.ts";
import {
  AMENITIES,
  type Amenity,
  type AmenityId,
  armouryCover,
  biospherePassengers,
  EXTERNAL_SYSTEMS,
  type ExternalSystem,
  type ExternalSystemId,
  FORCED_LINKAGE,
  forcedLinkageAt,
  ROBOTICS_AVATAR_CHAIRS,
  ROBOTICS_DRONE_CONTROLLERS,
  ROBOTICS_FABRICATORS,
  ROBOTICS_SWARM_CONTROLLERS,
  towCableTons,
  WORK_SPACES,
  type WorkSpace,
  type WorkSpaceId,
} from "../../catalog/fittings.ts";
import { counted, freshId, SectionHeading, tonLabel } from "./shared.tsx";

const ACCOMMODATIONS = [
  { id: "staterooms", label: "Staterooms" },
  { id: "commonTons", label: "Common space" },
  { id: "lowBerths", label: "Low berths" },
  { id: "emergencyLowBerths", label: "Emergency low berths" },
  { id: "cabinSpaces", label: "Cabin space" },
  { id: "accelerationBenches", label: "Acceleration benches" },
  { id: "accelerationSeats", label: "Acceleration seats" },
  { id: "barracks", label: "Barracks" },
  { id: "brigs", label: "Brig" },
  { id: "highStaterooms", label: "High staterooms" },
  { id: "luxuryStaterooms", label: "Luxury staterooms" },
] as const;

type AccommodationId = (typeof ACCOMMODATIONS)[number]["id"];

function Accommodations(
  { draft, onChange }: {
    draft: AdvancedDesign;
    onChange: (next: Partial<AdvancedDesign>) => void;
  },
) {
  const [pick, setPick] = useState("");
  const installed = ACCOMMODATIONS.filter((row) => draft[row.id] > 0);
  const available = ACCOMMODATIONS.filter((row) => draft[row.id] <= 0);
  const choice = available.some((row) => row.id === pick)
    ? pick
    : available[0]?.id ?? "";
  const apply = (id: AccommodationId, quantity: number) => {
    if (id === "staterooms") {
      const commonTons = draft.commonTons === draft.staterooms
        ? quantity
        : draft.commonTons;
      onChange({
        staterooms: quantity,
        commonTons,
        doubleStaterooms: Math.min(draft.doubleStaterooms, quantity),
      });
      return;
    }
    onChange({ [id]: quantity });
  };
  return (
    <details className="panel">
      <summary>Accommodations/Seating</summary>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Quantity</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {installed.map((row) => (
            <tr key={row.id}>
              <td>{row.label}</td>
              {row.id === "staterooms"
                ? (
                  <td colSpan={2}>
                    <div className="row stateroom-line">
                      <input
                        className="tons"
                        type="number"
                        min={1}
                        aria-label="Staterooms quantity"
                        value={draft.staterooms}
                        onChange={(event) => {
                          const raw = Number(event.currentTarget.value);
                          if (!Number.isFinite(raw)) return;
                          apply(row.id, Math.max(1, Math.round(raw)));
                        }}
                      />
                      <label className="check">
                        Double occupancy
                        <input
                          className="tons"
                          type="number"
                          min={0}
                          max={draft.staterooms}
                          aria-label="Double occupancy"
                          value={Math.min(
                            draft.doubleStaterooms,
                            draft.staterooms,
                          )}
                          onChange={(event) => {
                            const raw = Number(event.currentTarget.value);
                            if (!Number.isFinite(raw)) return;
                            onChange({
                              doubleStaterooms: Math.min(
                                draft.staterooms,
                                Math.max(0, Math.round(raw)),
                              ),
                            });
                          }}
                        />
                      </label>
                      <button type="button" onClick={() => apply(row.id, 0)}>
                        Remove
                      </button>
                    </div>
                  </td>
                )
                : (
                  <>
                    <td>
                      <input
                        type="number"
                        min={row.id === "commonTons" ? 0 : 1}
                        step={row.id === "commonTons" ? "any" : 1}
                        aria-label={`${row.label} quantity`}
                        value={draft[row.id]}
                        onChange={(event) => {
                          const raw = Number(event.currentTarget.value);
                          if (!Number.isFinite(raw)) return;
                          const quantity = row.id === "commonTons"
                            ? Math.max(0, Math.round(raw * 100) / 100)
                            : Math.max(1, Math.round(raw));
                          apply(row.id, quantity);
                        }}
                      />
                    </td>
                    <td>
                      <button type="button" onClick={() => apply(row.id, 0)}>
                        Remove
                      </button>
                    </td>
                  </>
                )}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row">
        <select
          aria-label="Add accommodation"
          value={choice}
          disabled={available.length === 0}
          onChange={(event) => setPick(event.currentTarget.value)}
        >
          {available.map((row) => (
            <option key={row.id} value={row.id}>{row.label}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!choice}
          onClick={() => apply(choice as AccommodationId, 1)}
        >
          Add
        </button>
      </div>
      {draft.staterooms > 0
        ? (
          <p className="meta">
            A double-occupancy stateroom holds two crew or one passenger.
          </p>
        )
        : null}
      {draft.emergencyLowBerths > 0
        ? <p className="meta">Each berth holds four people.</p>
        : null}
      {draft.barracks > 0
        ? (
          <p className="meta">
            One passenger per ton. Life support is Cr500 per ton.
          </p>
        )
        : null}
      {draft.brigs > 0
        ? (
          <p className="meta">
            Each brig holds six prisoners. Life support is Cr1,000.
          </p>
        )
        : null}
    </details>
  );
}

function Amenities(
  { amenities, techLevel, onChange }: {
    amenities: Amenity[];
    techLevel: number;
    onChange: (amenities: Amenity[]) => void;
  },
) {
  const [pick, setPick] = useState("");
  const taken = new Set(amenities.map((amenity) => amenity.kind));
  const available = AMENITIES.filter((amenity) =>
    !taken.has(amenity.id) && (!("tl" in amenity) || amenity.tl <= techLevel)
  );
  const choice = available.some((amenity) => amenity.id === pick)
    ? pick
    : available[0]?.id ?? "";
  const armoury = amenities.find((amenity) => amenity.kind === "armoury");
  const cover = armoury ? armouryCover(armoury.quantity) : null;
  const brewery = amenities.find((amenity) => amenity.kind === "brewery");
  const minimum = (kind: string) => {
    const amenity = AMENITIES.find((row) => row.id === kind);
    return amenity && "min" in amenity ? amenity.min : 1;
  };
  return (
    <details className="panel">
      <summary>Common fittings</summary>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Quantity</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {amenities.map((amenity) => {
            const kind = AMENITIES.find((row) => row.id === amenity.kind);
            return (
              <tr key={amenity.id}>
                <td>{kind?.label ?? amenity.kind}</td>
                <td>
                  <input
                    type="number"
                    min={minimum(amenity.kind)}
                    aria-label={`${kind?.label ?? "Fitting"} quantity`}
                    value={amenity.quantity}
                    onChange={(event) => {
                      const quantity = Math.max(
                        minimum(amenity.kind),
                        Math.round(Number(event.currentTarget.value)),
                      );
                      if (!Number.isFinite(quantity)) return;
                      onChange(
                        amenities.map((item) =>
                          item.id === amenity.id ? { ...item, quantity } : item
                        ),
                      );
                    }}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() =>
                      onChange(
                        amenities.filter((item) => item.id !== amenity.id),
                      )}
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
          aria-label="Add common fitting"
          value={choice}
          disabled={available.length === 0}
          onChange={(event) => setPick(event.currentTarget.value)}
        >
          {available.map((amenity) => (
            <option key={amenity.id} value={amenity.id}>{amenity.label}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!choice}
          onClick={() =>
            onChange([...amenities, {
              id: freshId(),
              kind: choice as AmenityId,
              quantity: minimum(choice),
            }])}
        >
          Add
        </button>
      </div>
      {amenities.some((amenity) => amenity.kind === "biosphere")
        ? (
          <p className="meta">
            Life support covered for {biospherePassengers(
              amenities.find((amenity) => amenity.kind === "biosphere")
                ?.quantity ?? 0,
            )} passengers.
          </p>
        )
        : null}
      {cover
        ? (
          <p className="meta">
            Covers {cover.crew} crew or {cover.marines} marines.
          </p>
        )
        : null}
      {brewery
        ? (
          <p className="meta">
            Each half-ton produces 10 litres of beer or liquor a week.
          </p>
        )
        : null}
      {amenities.some((amenity) =>
          amenity.kind === "pool" || amenity.kind === "endlessPool"
        )
        ? (
          <p className="meta">
            A swimming pool is at least 4 tons at Cr20,000 per ton. An endless
            pool is 2 tons and Cr50,000.
          </p>
        )
        : null}
    </details>
  );
}

function ExternalSystems({ systems, hullTons, techLevel, onChange }: {
  systems: ExternalSystem[];
  hullTons: number;
  techLevel: number;
  onChange: (systems: ExternalSystem[]) => void;
}) {
  const [pick, setPick] = useState("");
  const taken = new Set(systems.map((system) => system.kind));
  const available = EXTERNAL_SYSTEMS.filter((system) => !taken.has(system.id));
  const choice = available.some((system) => system.id === pick)
    ? pick
    : available[0]?.id ?? "";
  const tonsOf = (system: ExternalSystem) => {
    const kind = EXTERNAL_SYSTEMS.find((row) => row.id === system.kind);
    if (system.kind === "tow") return towCableTons(hullTons);
    if (system.kind === "holographic") return 0;
    return (kind?.tons ?? 0) * system.quantity;
  };
  return (
    <details className="panel">
      <summary>External Systems</summary>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Quantity</th>
            <th>Tons</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {systems.map((system) => {
            const kind = EXTERNAL_SYSTEMS.find((row) => row.id === system.kind);
            return (
              <tr key={system.id}>
                <td>
                  {kind?.label ?? system.kind}
                  {system.kind === "linkage"
                    ? (
                      <select
                        aria-label="Forced linkage apparatus tech level"
                        value={system.techLevel ?? FORCED_LINKAGE[0].tl}
                        onChange={(event) => {
                          const next =
                            forcedLinkageAt(Number(event.currentTarget.value))
                              .tl;
                          onChange(systems.map((item) =>
                            item.id === system.id
                              ? { ...item, techLevel: next }
                              : item
                          ));
                        }}
                      >
                        {FORCED_LINKAGE.map((tier) => (
                          <option key={tier.tl} value={tier.tl}>
                            {tier.label} (TL{tier.tl})
                          </option>
                        ))}
                      </select>
                    )
                    : null}
                </td>
                <td>
                  {kind?.counted
                    ? (
                      <input
                        type="number"
                        min={1}
                        aria-label={`${kind.label} quantity`}
                        value={system.quantity}
                        onChange={(event) => {
                          const quantity = Math.max(
                            1,
                            Math.round(Number(event.currentTarget.value)),
                          );
                          if (!Number.isFinite(quantity)) return;
                          onChange(
                            systems.map((item) =>
                              item.id === system.id
                                ? { ...item, quantity }
                                : item
                            ),
                          );
                        }}
                      />
                    )
                    : "—"}
                </td>
                <td>{tonLabel(tonsOf(system))}</td>
                <td>
                  <button
                    type="button"
                    onClick={() =>
                      onChange(systems.filter((item) => item.id !== system.id))}
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
          aria-label="Add external system"
          value={choice}
          disabled={available.length === 0}
          onChange={(event) => setPick(event.currentTarget.value)}
        >
          {available.map((system) => (
            <option key={system.id} value={system.id}>{system.label}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!choice}
          onClick={() =>
            onChange([...systems, {
              id: freshId(),
              kind: choice as ExternalSystemId,
              quantity: 1,
              ...(choice === "linkage"
                ? { techLevel: forcedLinkageAt(techLevel).tl }
                : {}),
            }])}
        >
          Add
        </button>
      </div>
      {systems.some((system) => system.kind === "breaching")
        ? <p className="meta">DM+1 to boarding actions.</p>
        : null}
      {systems.map((system) => {
        const kind = EXTERNAL_SYSTEMS.find((row) => row.id === system.kind);
        if (!kind || !("holds" in kind)) return null;
        return (
          <p className="meta" key={system.id}>
            {kind.label} holds ships of {kind.holds} tons.
          </p>
        );
      })}
      {systems.filter((system) => system.kind === "linkage").map((system) => {
        const tier = forcedLinkageAt(system.techLevel ?? 0);
        const dm = tier.dm > 0
          ? `+${tier.dm}`
          : tier.dm < 0
          ? String(tier.dm)
          : "+0";
        return (
          <p className="meta" key={system.id}>
            Pilot check DM {dm}. Usable on ships up to 5,000 tons.
          </p>
        );
      })}
      {systems.some((system) => system.kind === "grappling")
        ? <p className="meta">Each arm can manipulate 2 tons.</p>
        : null}
      {systems.some((system) => system.kind === "heavyGrappling")
        ? <p className="meta">Each heavy arm can manipulate 10 tons.</p>
        : null}
      {systems.some((system) => system.kind === "reentryCapsule")
        ? <p className="meta">Each capsule carries one person.</p>
        : null}
      {systems.some((system) => system.kind === "reentryPod")
        ? (
          <p className="meta">
            Each pod carries two people. A pilot can steer the descent with
            Flyer (wing).
          </p>
        )
        : null}
    </details>
  );
}

function WorkSpaces({ spaces, onChange }: {
  spaces: WorkSpace[];
  onChange: (spaces: WorkSpace[]) => void;
}) {
  const [pick, setPick] = useState("");
  const taken = new Set(spaces.map((space) => space.kind));
  const available = WORK_SPACES.filter((space) => !taken.has(space.id));
  const choice = available.some((space) => space.id === pick)
    ? pick
    : available[0]?.id ?? "";
  return (
    <details className="panel">
      <summary>Work spaces</summary>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Quantity</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {spaces.map((space) => {
            const kind = WORK_SPACES.find((row) => row.id === space.kind);
            const setOption = (patch: Partial<WorkSpace>) =>
              onChange(spaces.map((item) =>
                item.id === space.id ? { ...item, ...patch } : item
              ));
            return (
              <tr key={space.id}>
                <td>
                  {kind?.label ?? space.kind}
                  {space.kind === "robotics"
                    ? (
                      <>
                        <select
                          aria-label="Robotics laboratory avatar chair"
                          value={space.avatarChair ?? "none"}
                          onChange={(event) =>
                            setOption({
                              avatarChair: event.currentTarget
                                .value as WorkSpace["avatarChair"],
                            })}
                        >
                          {ROBOTICS_AVATAR_CHAIRS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.tl > 0
                                ? `${option.label} (TL${option.tl})`
                                : option.label}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label="Robotics laboratory fabrication chamber"
                          value={space.fabrication ?? "none"}
                          onChange={(event) =>
                            setOption({
                              fabrication: event.currentTarget
                                .value as WorkSpace["fabrication"],
                            })}
                        >
                          {ROBOTICS_FABRICATORS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.tl > 0
                                ? `Fabrication chamber, ${option.label} (TL${option.tl})`
                                : option.label}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label="Robotics laboratory drone controller"
                          value={space.droneController ?? "none"}
                          onChange={(event) =>
                            setOption({
                              droneController: event.currentTarget
                                .value as WorkSpace["droneController"],
                            })}
                        >
                          {ROBOTICS_DRONE_CONTROLLERS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.tl > 0
                                ? `Drone controller, ${option.label} (TL${option.tl})`
                                : option.label}
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label="Robotics laboratory swarm controller"
                          value={space.swarmController ?? "none"}
                          onChange={(event) =>
                            setOption({
                              swarmController: event.currentTarget
                                .value as WorkSpace["swarmController"],
                            })}
                        >
                          {ROBOTICS_SWARM_CONTROLLERS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.tl > 0
                                ? `Swarm controller, ${option.label} (TL${option.tl})`
                                : option.label}
                            </option>
                          ))}
                        </select>
                      </>
                    )
                    : null}
                </td>
                <td>
                  <input
                    type="number"
                    min={1}
                    aria-label={`${kind?.label ?? "Work space"} quantity`}
                    value={space.quantity}
                    onChange={(event) => {
                      const quantity = Math.max(
                        1,
                        Math.round(Number(event.currentTarget.value)),
                      );
                      if (!Number.isFinite(quantity)) return;
                      onChange(spaces.map((item) =>
                        item.id === space.id ? { ...item, quantity } : item
                      ));
                    }}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() =>
                      onChange(spaces.filter((item) =>
                        item.id !== space.id
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
          aria-label="Add work space"
          value={choice}
          disabled={available.length === 0}
          onChange={(event) =>
            setPick(event.currentTarget.value)}
        >
          {available.map((space) => (
            <option key={space.id} value={space.id}>{space.label}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!choice}
          onClick={() =>
            onChange([...spaces, {
              id: freshId(),
              kind: choice as WorkSpaceId,
              quantity: 1,
              ...(choice === "robotics"
                ? {
                  avatarChair: "none" as const,
                  fabrication: "none" as const,
                  droneController: "none" as const,
                  swarmController: "none" as const,
                }
                : {}),
            }])}
        >
          Add
        </button>
      </div>
      {spaces.some((space) => space.kind === "robotics")
        ? (
          <p className="meta">
            The laboratory has room for one avatar chair, one 128-slot
            fabrication chamber, and controllers.
          </p>
        )
        : null}
    </details>
  );
}

function accommodationValues(draft: AdvancedDesign): string[] {
  const values: string[] = [];
  for (const row of ACCOMMODATIONS) {
    const quantity = draft[row.id];
    if (quantity <= 0) continue;
    if (row.id === "staterooms" && draft.doubleStaterooms > 0) {
      values.push(
        `${counted(row.label, quantity)} (${
          Math.min(draft.doubleStaterooms, quantity)
        } double)`,
      );
    } else {
      values.push(counted(row.label, quantity));
    }
  }
  for (const amenity of draft.amenities) {
    const label = AMENITIES.find((row) => row.id === amenity.kind)?.label ??
      amenity.kind;
    values.push(counted(label, amenity.quantity));
  }
  for (const system of draft.externalSystems) {
    const label = EXTERNAL_SYSTEMS.find((row) =>
      row.id === system.kind
    )?.label ?? system.kind;
    values.push(counted(label, system.quantity));
  }
  for (const space of draft.workSpaces) {
    const label = WORK_SPACES.find((row) => row.id === space.kind)?.label ??
      space.kind;
    values.push(counted(label, space.quantity));
  }
  return values;
}

export function AccommodationsSection({ draft, onChange }: {
  draft: AdvancedDesign;
  onChange: (next: Partial<AdvancedDesign>) => void;
}) {
  return (
    <details className="panel">
      <summary>
        <SectionHeading
          title="Accommodations and Fittings"
          values={accommodationValues(draft)}
        />
      </summary>
      <Accommodations draft={draft} onChange={onChange} />
      <Amenities
        amenities={draft.amenities}
        techLevel={draft.techLevel}
        onChange={(amenities) => onChange({ amenities })}
      />
      <ExternalSystems
        systems={draft.externalSystems}
        hullTons={draft.hullTons}
        techLevel={draft.techLevel}
        onChange={(externalSystems) => onChange({ externalSystems })}
      />
      <WorkSpaces
        spaces={draft.workSpaces}
        onChange={(workSpaces) => onChange({ workSpaces })}
      />
    </details>
  );
}

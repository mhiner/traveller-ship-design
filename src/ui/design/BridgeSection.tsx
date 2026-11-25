import { useState } from "../../runtime.ts";
import type { AdvancedDesign, DesignSheet } from "../../design.ts";
import { blankCustomShipBrain } from "../../shipBrain.ts";
import {
  ADDITIONAL_SENSORS,
  type AdditionalSensor,
  type AdditionalSensorId,
  additionalSensorQuote,
  SENSOR_STATION_MAX_HULL,
  SENSORS,
} from "../../catalog/sensors.ts";
import {
  availableSoftware,
  bridgesAt,
  COMPUTER_TYPES,
  COMPUTERS,
  installedSoftware,
  SHIP_BRAIN_INTERFACES,
  SHIP_BRAINS,
  type ShipBrainId,
  type ShipBrainInterfaceId,
  type SoftwareId,
} from "../../catalog/bridge.ts";
import { CustomShipBrainPanel } from "../CustomShipBrain.tsx";
import { NumberField } from "../fields.tsx";
import {
  Choice,
  counted,
  freshId,
  money,
  SectionHeading,
  tonLabel,
} from "./shared.tsx";

function SoftwareTable({ installed, techLevel, onChange }: {
  installed: SoftwareId[];
  techLevel: number;
  onChange: (software: SoftwareId[]) => void;
}) {
  const [pick, setPick] = useState("");
  const programs = installedSoftware(installed);
  const available = availableSoftware(installed, techLevel);
  const choice = available.some((program) => program.id === pick)
    ? pick
    : available[0]?.id ?? "";
  return (
    <details className="panel">
      <summary>Software</summary>
      <table>
        <thead>
          <tr>
            <th>Program</th>
            <th>Bandwidth</th>
            <th>Cost</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {programs.map((program) => (
            <tr key={program.id}>
              <td>{program.label}</td>
              <td>{program.bandwidth}</td>
              <td>{program.cost ? money(program.cost) : "Included"}</td>
              <td>
                <button
                  type="button"
                  onClick={() =>
                    onChange(installed.filter((id) => id !== program.id))}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row">
        <select
          aria-label="Add software"
          value={choice}
          disabled={available.length === 0}
          onChange={(event) => setPick(event.currentTarget.value)}
        >
          {available.map((program) => (
            <option key={program.id} value={program.id}>{program.label}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!choice}
          onClick={() => onChange([...installed, choice as SoftwareId])}
        >
          Add
        </button>
      </div>
      <p className="meta">
        Advanced Fire Control does not stack with Fire Control. Screen Optimiser
        needs a screen. Virtual Crew needs one more bandwidth for every five
        crew after the first five, and Virtual Gunner needs one more for every
        10 gunners after the first 10.
      </p>
    </details>
  );
}

function AdditionalSensors({ installed, hullTons, suiteId, onChange }: {
  installed: AdditionalSensor[];
  hullTons: number;
  suiteId: string;
  onChange: (sensors: AdditionalSensor[]) => void;
}) {
  const [pick, setPick] = useState("");
  const suite = SENSORS.find((row) => row.id === suiteId) ?? SENSORS[0];
  const taken = new Set(installed.map((sensor) => sensor.kind));
  const available = ADDITIONAL_SENSORS.filter((sensor) =>
    !taken.has(sensor.id)
  );
  const choice = available.some((sensor) => sensor.id === pick)
    ? pick
    : available[0]?.id ?? "";
  const fitted = (kind: AdditionalSensor["kind"]) =>
    installed.some((sensor) => sensor.kind === kind);
  return (
    <details className="panel">
      <summary>Additional sensors</summary>
      <table>
        <thead>
          <tr>
            <th>Option</th>
            <th>Tons</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {installed.map((sensor) => {
            const kind = ADDITIONAL_SENSORS.find((row) =>
              row.id === sensor.kind
            );
            const quoted = additionalSensorQuote(
              sensor.kind,
              sensor.tons,
              hullTons,
              suite,
            );
            return (
              <tr key={sensor.id}>
                <td>{kind?.label ?? sensor.kind}</td>
                <td>
                  {sensor.kind === "deep"
                    ? (
                      <input
                        type="number"
                        min={1}
                        aria-label="Deep Penetration Scanners tons"
                        value={sensor.tons}
                        onChange={(event) => {
                          const tons = Math.max(
                            1,
                            Math.round(Number(event.currentTarget.value)),
                          );
                          if (!Number.isFinite(tons)) return;
                          onChange(
                            installed.map((item) =>
                              item.id === sensor.id ? { ...item, tons } : item
                            ),
                          );
                        }}
                      />
                    )
                    : tonLabel(quoted.tons)}
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() =>
                      onChange(
                        installed.filter((item) => item.id !== sensor.id),
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
      {fitted("rapid")
        ? (
          <p className="meta">
            Triples the sensor suite's tonnage and power, and multiplies its
            cost by five.
          </p>
        )
        : null}
      {fitted("distributed")
        ? (
          <p className="meta">
            Triples the tonnage, cost, and power of Improved or Advanced sensors
            on a hull of more than 5,000 tons.
          </p>
        )
        : null}
      {fitted("extension")
        ? (
          <p className="meta">
            1% of the hull, at least one ton, at MCr1 per ton.
          </p>
        )
        : null}
      {fitted("deep")
        ? (
          <p className="meta">
            Each ton scans 20 tons of a target ship per hour, at MCr1 per ton.
            Power 1.
          </p>
        )
        : null}
      <div className="row">
        <select
          aria-label="Add additional sensor"
          value={choice}
          disabled={available.length === 0}
          onChange={(event) => setPick(event.currentTarget.value)}
        >
          {available.map((sensor) => (
            <option key={sensor.id} value={sensor.id}>{sensor.label}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!choice}
          onClick={() =>
            onChange([...installed, {
              id: freshId(),
              kind: choice as AdditionalSensorId,
              tons: 1,
            }])}
        >
          Add
        </button>
      </div>
    </details>
  );
}

function bridgeValues(draft: AdvancedDesign): string[] {
  const computer = COMPUTERS.find((row) => row.id === draft.computer)?.label ??
    draft.computer;
  const computerType = COMPUTER_TYPES.find((row) =>
    row.id === draft.computerType
  );
  const bridge =
    bridgesAt(draft.hullTons).find((row) => row.id === draft.bridge)?.label ??
      draft.bridge;
  const sensors = SENSORS.find((row) => row.id === draft.sensors)?.label ??
    draft.sensors;
  const values = [
    computerType && computerType.id !== "standard"
      ? `${computer} ${computerType.label}`
      : computer,
    bridge,
  ];
  if (draft.holographicControls) values.push("Holographic controls");
  if (draft.sensorStations > 0) {
    values.push(counted("Sensor station", draft.sensorStations));
  }
  values.push(`${sensors} sensors`);
  if (draft.shipBrain !== "none") {
    const brain = SHIP_BRAINS.find((row) =>
      row.id === draft.shipBrain
    )?.label ?? draft.shipBrain;
    const face = SHIP_BRAIN_INTERFACES.find((row) =>
      row.id === draft.shipBrainInterface
    );
    values.push(
      face && face.id !== "none" ? `${brain} (${face.label})` : brain,
    );
  }
  for (const sensor of draft.additionalSensors) {
    const kind = ADDITIONAL_SENSORS.find((row) => row.id === sensor.kind);
    values.push(
      sensor.kind === "deep"
        ? `${kind?.label ?? sensor.kind} ${tonLabel(sensor.tons)}`
        : (kind?.label ?? sensor.kind),
    );
  }
  values.push(
    ...installedSoftware(draft.software).map((program) => program.label),
  );
  return values;
}

export function BridgeSection({ draft, sheet, onChange }: {
  draft: AdvancedDesign;
  sheet: DesignSheet;
  onChange: (next: Partial<AdvancedDesign>) => void;
}) {
  if (draft.hullType === "module") return null;
  return (
    <details className="panel">
      <summary>
        <SectionHeading
          title="Bridge, Computer, and Sensors"
          values={bridgeValues(draft)}
        />
      </summary>
      <div className="grid">
        <Choice
          label="Computer"
          value={draft.computer}
          options={COMPUTERS}
          onChange={(computer) => onChange({ computer })}
        />
        <Choice
          label="Computer type"
          value={draft.computerType}
          options={COMPUTER_TYPES}
          onChange={(computerType) => onChange({ computerType })}
        />
        <Choice
          label="Bridge"
          value={draft.bridge}
          options={bridgesAt(draft.hullTons)}
          onChange={(bridge) => onChange({ bridge })}
        />
        <Choice
          label="Holographic controls"
          value={draft.holographicControls ? "yes" : "no"}
          options={[{ id: "yes", label: "Yes" }, { id: "no", label: "No" }]}
          onChange={(value) =>
            onChange({ holographicControls: value === "yes" })}
        />
        <NumberField
          label="Sensor stations"
          value={draft.sensorStations}
          min={0}
          step={1}
          onChange={(sensorStations) =>
            onChange({
              sensorStations: Math.max(0, Math.trunc(sensorStations) || 0),
            })}
        />
        <Choice
          label={`Sensors (${sheet.powerUse.sensors})`}
          value={draft.sensors}
          options={SENSORS}
          onChange={(sensors) => onChange({ sensors })}
        />
        <Choice
          label="Ship's Brain"
          value={draft.shipBrain}
          options={SHIP_BRAINS.filter((brain) =>
            brain.id === "none" || brain.id === draft.shipBrain ||
            brain.tl <= draft.techLevel
          )}
          onChange={(shipBrain) =>
            onChange(
              shipBrain === "none"
                ? { shipBrain: "none", shipBrainInterface: "none" }
                : shipBrain === "custom"
                ? {
                  shipBrain: "custom",
                  customShipBrain: draft.customShipBrain ??
                    blankCustomShipBrain(draft.techLevel),
                }
                : { shipBrain: shipBrain as ShipBrainId },
            )}
        />
        {draft.shipBrain !== "none"
          ? (
            <Choice
              label="Ship's Brain Interface"
              value={draft.shipBrainInterface}
              options={SHIP_BRAIN_INTERFACES}
              onChange={(shipBrainInterface) =>
                onChange({
                  shipBrainInterface:
                    shipBrainInterface as ShipBrainInterfaceId,
                })}
            />
          )
          : null}
      </div>
      {draft.holographicControls
        ? <p className="meta">Initiative checks gain DM+2.</p>
        : null}
      {draft.hullTons > SENSOR_STATION_MAX_HULL
        ? (
          <p className="meta">
            Sensor stations are included in the bridge of a hull above 7,500
            tons.
          </p>
        )
        : (
          <p className="meta">
            The bridge covers one sensor task. Each station is 1 ton and MCr0.5,
            and covers one more task.
          </p>
        )}
      {draft.shipBrain !== "none" && draft.shipBrainInterface === "haptics"
        ? (
          <p className="meta">
            Pilot and manipulator checks use DEX {draft.shipBrain === "custom"
              ? draft.techLevel
              : SHIP_BRAINS.find((brain) => brain.id === draft.shipBrain)?.tl ??
                0}.
          </p>
        )
        : null}
      {draft.shipBrain === "custom"
        ? (
          <CustomShipBrainPanel
            brain={draft.customShipBrain}
            techLevel={draft.techLevel}
            haptics={draft.shipBrainInterface === "haptics"}
            onChange={(customShipBrain) => onChange({ customShipBrain })}
          />
        )
        : null}
      <AdditionalSensors
        installed={draft.additionalSensors}
        hullTons={draft.hullTons}
        suiteId={draft.sensors}
        onChange={(additionalSensors) => onChange({ additionalSensors })}
      />
      <SoftwareTable
        installed={draft.software}
        techLevel={draft.techLevel}
        onChange={(software) => onChange({ software })}
      />
    </details>
  );
}

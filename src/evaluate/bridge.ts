import type { AdvancedDesign, DesignLine } from "../design.ts";
import { quoteCustomShipBrain } from "../shipBrain.ts";
import { resolveAdditionalSensors } from "../resolve.ts";
import {
  ADDITIONAL_SENSORS,
  additionalSensorQuote,
  SENSOR_STATION_COST,
  SENSOR_STATION_MAX_HULL,
  SENSOR_STATION_TONS,
  SENSORS,
} from "../catalog/sensors.ts";
import {
  bridgeCost,
  type BridgeId,
  BRIDGES,
  commandBridgeCost,
  COMPUTER_TYPES,
  COMPUTERS,
  installedSoftware,
  SHIP_BRAIN_INTERFACES,
  SHIP_BRAINS,
  shipBrainCost,
  shipBrainInterfaceCost,
  smallBridgeTons,
  standardBridgeTons,
} from "../catalog/bridge.ts";
import { countedName, findById, round3, sheetLine, whole } from "./shared.ts";

function bridgeFor(
  hullTons: number,
  bridge: BridgeId,
): { line: DesignLine; error: string | null } {
  const chosen = findById(BRIDGES, bridge, BRIDGES[2]);
  if (chosen.id === "cockpit") {
    return {
      line: sheetLine("bridge", { name: chosen.label, tons: 1.5, cost: 0.01 }),
      error: hullTons <= 50
        ? null
        : "A single cockpit is only available at 50 tons or less.",
    };
  }
  if (chosen.id === "dual") {
    return {
      line: sheetLine("bridge", { name: chosen.label, tons: 2.5, cost: 0.015 }),
      error: hullTons <= 50
        ? null
        : "A double cockpit is only available at 50 tons or less.",
    };
  }
  if (chosen.id === "small") {
    const tons = smallBridgeTons(hullTons);
    return {
      line: sheetLine("bridge", {
        name: chosen.label,
        tons: tons ?? standardBridgeTons(hullTons),
        cost: round3(bridgeCost(hullTons) / 2),
      }),
      error: tons === null
        ? "A small bridge is only available above 50 tons."
        : null,
    };
  }
  if (chosen.id === "command") {
    return {
      line: sheetLine("bridge", {
        name: chosen.label,
        tons: 80,
        cost: round3(commandBridgeCost(hullTons)),
      }),
      error: hullTons >= 5000
        ? null
        : "A command bridge is only available at 5,000 tons or more.",
    };
  }
  return {
    line: sheetLine("bridge", {
      name: chosen.label,
      tons: standardBridgeTons(hullTons),
      cost: bridgeCost(hullTons),
    }),
    error: null,
  };
}

export interface BridgeSection {
  lines: DesignLine[];
  /** Extra-sensor checks that the power total depends on. They are reported before drive errors. */
  sensorErrors: string[];
  errors: string[];
  warnings: string[];
  sensorPower: number;
}

export function buildBridge(
  design: AdvancedDesign,
  hullTons: number,
  moduleHull: boolean,
  poweredModule: boolean,
  techLevel: number,
  jump: number,
): BridgeSection {
  const sensorErrors: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const lines: DesignLine[] = [];
  const sensors = findById(SENSORS, design.sensors, SENSORS[0]);
  const computer = findById(COMPUTERS, design.computer, COMPUTERS[0]);
  const computerType = findById(
    COMPUTER_TYPES,
    design.computerType,
    COMPUTER_TYPES[0],
  );
  const extraSensors = resolveAdditionalSensors(design.additionalSensors);
  let extraSensorPower = 0;
  if (!moduleHull) {
    for (const sensor of extraSensors) {
      const kind = findById(
        ADDITIONAL_SENSORS,
        sensor.kind,
        ADDITIONAL_SENSORS[0],
      );
      if (techLevel < kind.tl) {
        sensorErrors.push(`${kind.label} requires tech level ${kind.tl}.`);
      }
      if (kind.id === "distributed") {
        if (sensors.id !== "improved" && sensors.id !== "advanced") {
          sensorErrors.push(
            `${kind.label} can only be added to Improved or Advanced sensors.`,
          );
        }
        if (hullTons <= 5000) {
          sensorErrors.push(
            `${kind.label} requires a hull of more than 5,000 tons.`,
          );
        }
      }
      extraSensorPower +=
        additionalSensorQuote(kind.id, sensor.tons, hullTons, sensors).power;
    }
  }
  const showSensors = !moduleHull || poweredModule || sensors.id !== "basic";
  const sensorPower = showSensors
    ? sensors.power + (moduleHull ? 0 : extraSensorPower)
    : 0;

  if (!moduleHull) {
    const bridge = bridgeFor(hullTons, design.bridge);
    lines.push(bridge.line);
    if (bridge.error) errors.push(bridge.error);
    if (design.holographicControls) {
      lines.push(
        sheetLine("controls", {
          name: "Holographic controls",
          tons: 0,
          cost: round3(bridge.line.cost * 0.25),
        }),
      );
      if (techLevel < 9) {
        errors.push("Holographic controls require tech level 9.");
      }
    }
    const sensorStations = whole(design.sensorStations);
    if (sensorStations > 0 && hullTons > SENSOR_STATION_MAX_HULL) {
      errors.push(
        "Sensor stations are only available on hulls of 7,500 tons or less.",
      );
    } else if (sensorStations > 0) {
      lines.push(sheetLine("sensorStation", {
        name: countedName("Sensor station", sensorStations),
        tons: sensorStations * SENSOR_STATION_TONS,
        cost: round3(sensorStations * SENSOR_STATION_COST),
      }));
    }
  }

  if (!moduleHull || poweredModule) {
    if (
      !moduleHull || sensors.tons > 0 || sensors.cost > 0 || sensors.power > 0
    ) {
      lines.push(
        sheetLine("sensors", {
          name: `${sensors.label} sensors`,
          tons: sensors.tons,
          cost: sensors.cost,
          power: sensors.power,
        }),
      );
      if (techLevel < sensors.tl) {
        errors.push(
          `${sensors.label} sensors require tech level ${sensors.tl}.`,
        );
      }
    }
    for (const sensor of extraSensors) {
      const kind = findById(
        ADDITIONAL_SENSORS,
        sensor.kind,
        ADDITIONAL_SENSORS[0],
      );
      const quoted = additionalSensorQuote(
        kind.id,
        sensor.tons,
        hullTons,
        sensors,
      );
      lines.push(
        sheetLine("sensorExtra", {
          name: kind.label,
          tons: quoted.tons,
          cost: quoted.cost,
          ...(quoted.power > 0 ? { power: quoted.power } : {}),
        }),
      );
    }
    const computerCost = round3(computer.cost * computerType.costFactor);
    const computerName = computerType.id === "standard"
      ? computer.label
      : `${computer.label} ${computerType.label.toLowerCase()}`;
    lines.push(
      sheetLine("computer", {
        name: computerName,
        tons: 0,
        cost: computerCost,
      }),
    );
    if (techLevel < computer.tl) {
      errors.push(`${computer.label} requires tech level ${computer.tl}.`);
    }
    const programs = installedSoftware(design.software ?? []);
    for (const program of programs) {
      lines.push(
        sheetLine("software", {
          name: program.label,
          tons: 0,
          cost: program.cost,
          fold: "software",
        }),
      );
      if (techLevel < program.tl) {
        errors.push(`${program.label} requires tech level ${program.tl}.`);
      }
    }
    const jumpProgram = programs.find((program) => program.group === "jump");
    if (jump > 0 && (jumpProgram?.rating ?? 0) < jump) {
      warnings.push(`Jump ${jump} requires Jump Control/${jump} or higher.`);
    }
    if (programs.some((program) => program.id === "screenOptimiser")) {
      warnings.push("Screen Optimiser requires a screen.");
    }
    const bandwidth = programs.reduce(
      (total, program) => total + program.bandwidth,
      0,
    );
    const jumpCovered =
      jumpProgram && (computerType.id === "bis" || computerType.id === "bisfib")
        ? Math.min(5, jumpProgram.bandwidth)
        : 0;
    const capacity = computer.bandwidth + jumpCovered;
    if (bandwidth > capacity) {
      warnings.push(
        `Software uses ${bandwidth} bandwidth and the computer provides ${capacity}.`,
      );
    }

    const brain = findById(SHIP_BRAINS, design.shipBrain, SHIP_BRAINS[0]);
    const brainInterface = brain.id === "none"
      ? "none"
      : (SHIP_BRAIN_INTERFACES.some((row) =>
          row.id === design.shipBrainInterface
        )
        ? design.shipBrainInterface
        : "none");
    if (brain.id !== "none") {
      if (brain.id === "custom") {
        const quoted = quoteCustomShipBrain(
          design.customShipBrain,
          techLevel,
          brainInterface === "haptics",
        );
        lines.push(...quoted.lines.map((row) => sheetLine("brain", row)));
        errors.push(...quoted.errors);
        warnings.push(...quoted.warnings);
      } else {
        lines.push(
          sheetLine("brain", {
            name: `Ship's brain (${brain.label})`,
            tons: 0,
            cost: shipBrainCost(brain.id, techLevel),
          }),
        );
        if (techLevel < brain.tl) {
          errors.push(`${brain.label} requires tech level ${brain.tl}.`);
        }
      }
      if (brainInterface !== "none") {
        const fitted = findById(
          SHIP_BRAIN_INTERFACES,
          brainInterface,
          SHIP_BRAIN_INTERFACES[0],
        );
        lines.push(
          sheetLine("brain", {
            name: fitted.label,
            tons: 0,
            cost: shipBrainInterfaceCost(fitted.id, hullTons),
          }),
        );
        if (techLevel < 10) {
          errors.push(`${fitted.label} requires tech level 10.`);
        }
      }
    }
  } else if (sensors.id !== "basic") {
    lines.push(
      sheetLine("sensors", {
        name: `${sensors.label} sensors`,
        tons: sensors.tons,
        cost: sensors.cost,
        power: sensors.power,
      }),
    );
    if (techLevel < sensors.tl) {
      errors.push(`${sensors.label} sensors require tech level ${sensors.tl}.`);
    }
  }

  return { lines, sensorErrors, errors, warnings, sensorPower };
}

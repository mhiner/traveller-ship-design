import {
  type AdvancedDesign,
  type DesignLine,
  type DesignSheet,
  evaluateDesign,
  type LineRole,
} from "./design.ts";
import { orderSheetLines } from "./sheetOrder.ts";
import {
  ARMOUR,
  type ConfigurationId,
  CONFIGURATIONS,
  driveEffectiveTons,
  HULL_OPTIONS,
  HULL_TYPES,
  type HullOptionId,
  type HullTypeId,
  POWER_PLANTS,
} from "./tables.ts";

/** Highest precedence first. Buffered planetoid outranks streamlined. */
const CONFIGURATION_PRECEDENCE: readonly ConfigurationId[] = [
  "buffered",
  "planetoid",
  "distributed",
  "close",
  "sphere",
  "standard",
  "streamlined",
];

/** Highest precedence first. Light hull outranks reinforced. */
const HULL_TYPE_PRECEDENCE: readonly HullTypeId[] = [
  "light",
  "standard",
  "reinforced",
  "module",
];

const CREW_ORDER = [
  "Command",
  "Pilot",
  "Astrogator",
  "Engineer",
  "Maintenance",
  "Gunner",
  "Medic",
  "Steward",
];

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function precedence<T extends string>(order: readonly T[], value: T): number {
  const index = order.indexOf(value);
  return index === -1 ? order.length : index;
}

function preferred<T extends string>(
  order: readonly T[],
  values: readonly T[],
): T {
  return values.reduce((best, value) =>
    precedence(order, value) < precedence(order, best) ? value : best
  );
}

function weightedFloor(
  pairs: readonly { rating: number; tons: number }[],
): number {
  const tons = pairs.reduce((total, pair) => total + pair.tons, 0);
  if (tons <= 0) return 0;
  const weighted = pairs.reduce(
    (total, pair) => total + pair.rating * pair.tons,
    0,
  );
  return Math.floor(weighted / tons + 1e-9);
}

/** Joined thrust is the sum of each hull's rating times its drive tonnage, divided by actual tonnage, rounded down. */
function combinedManoeuvre(
  hulls: readonly { hull: AdvancedDesign; sheet: DesignSheet }[],
  hullTons: readonly number[],
): number {
  const total = hullTons.reduce((sum, tons) => sum + tons, 0);
  if (total <= 0) return 0;
  const potential = hulls.reduce((sum, entry, index) => {
    const hasDrive = entry.sheet.lines.some((line) =>
      line.role === "manoeuvre"
    );
    if (!hasDrive) return sum;
    const rating = Number.isFinite(entry.hull.thrust)
      ? Math.max(0, Math.trunc(entry.hull.thrust))
      : 0;
    return sum +
      rating *
        driveEffectiveTons(hullTons[index], entry.hull.driveCustom?.thrust);
  }, 0);
  return Math.min(11, Math.floor(potential / total + 1e-9));
}

function linesWithRole(
  lines: readonly DesignLine[],
  role: LineRole,
): DesignLine[] {
  return lines.filter((line) => line.role === role);
}

function hullLine(lines: readonly DesignLine[]): DesignLine | undefined {
  return lines.find((line) => line.role === "hull");
}

function armourLines(lines: readonly DesignLine[]): DesignLine[] {
  return linesWithRole(lines, "armour");
}

function optionLines(
  lines: readonly DesignLine[],
  kind: HullOptionId,
): DesignLine[] {
  return lines.filter((line) =>
    line.role === "hullOption" && line.option === kind
  );
}

function driveLines(
  lines: readonly DesignLine[],
  role: "manoeuvre" | "jump",
): DesignLine[] {
  return linesWithRole(lines, role);
}

function plantLines(lines: readonly DesignLine[]): DesignLine[] {
  return linesWithRole(lines, "plant");
}

function computerLine(lines: readonly DesignLine[]): DesignLine | undefined {
  return lines.find((line) => line.role === "computer");
}

function sensorLine(lines: readonly DesignLine[]): DesignLine | undefined {
  return lines.find((line) => line.role === "sensors");
}

function bridgeLine(lines: readonly DesignLine[]): DesignLine | undefined {
  return lines.find((line) => line.role === "bridge");
}

const COMBINED_APART = new Set<LineRole>([
  "hull",
  "armour",
  "hullOption",
  "manoeuvre",
  "jump",
  "plant",
  "computer",
  "sensors",
  "bridge",
  "sensorStation",
]);

function isCombinedApart(line: DesignLine): boolean {
  return COMBINED_APART.has(line.role);
}

function summed(
  lines: readonly DesignLine[],
): { tons: number; cost: number; power: number } {
  return {
    tons: round2(lines.reduce((total, line) => total + line.tons, 0)),
    cost: round3(lines.reduce((total, line) => total + line.cost, 0)),
    power: lines.reduce((total, line) => total + (line.power ?? 0), 0),
  };
}

function addComponent(
  components: Map<string, DesignLine>,
  line: DesignLine,
): void {
  const existing = components.get(line.name);
  if (!existing) {
    components.set(line.name, { ...line });
    return;
  }
  const hasPower = existing.power != null || line.power != null;
  components.set(line.name, {
    name: line.name,
    tons: round2(existing.tons + line.tons),
    cost: round3(existing.cost + line.cost),
    ...(hasPower ? { power: (existing.power ?? 0) + (line.power ?? 0) } : {}),
    ...(existing.carried && line.carried ? { carried: true } : {}),
    ...(existing.fold || line.fold ? { fold: existing.fold ?? line.fold } : {}),
    ...(existing.head || line.head ? { head: existing.head ?? line.head } : {}),
    role: existing.role,
    ...(existing.option || line.option
      ? { option: existing.option ?? line.option }
      : {}),
  });
}

export interface CombinedBreakaway {
  /** Display copy only. It is not saved. */
  design: AdvancedDesign;
  sheet: DesignSheet;
}

/** Performance of a breakaway ship and the hulls joined to it. Nothing here is written to the design list. */
export function combinedBreakaway(
  hulls: readonly AdvancedDesign[],
  catalog: readonly AdvancedDesign[] = [],
  prepared?: readonly (DesignSheet | undefined)[],
): CombinedBreakaway {
  const evaluated = hulls.map((hull, index) => ({
    hull,
    sheet: prepared?.[index] ?? evaluateDesign(hull, catalog),
  }));
  const hullTons = evaluated.map((entry) =>
    hullLine(entry.sheet.lines)?.tons ?? entry.hull.hullTons
  );
  const totalTons = round2(hullTons.reduce((total, tons) => total + tons, 0));
  const configuration = preferred(
    CONFIGURATION_PRECEDENCE,
    evaluated.map((entry) => entry.hull.configuration),
  );
  const hullType = preferred(
    HULL_TYPE_PRECEDENCE,
    evaluated.map((entry) => entry.hull.hullType),
  );
  const configurationLabel =
    CONFIGURATIONS.find((row) => row.id === configuration)?.label ?? "Standard";
  const hullTypeLabel = HULL_TYPES.find((row) => row.id === hullType)?.label ??
    "Standard";
  const hullName = hullType === "standard"
    ? `${configurationLabel} hull`
    : `${hullTypeLabel}, ${configurationLabel} hull`;
  const hullParts = summed(evaluated.flatMap((entry) => {
    const line = hullLine(entry.sheet.lines);
    return line ? [line] : [];
  }));
  const armourIds = evaluated.map((entry) => entry.hull.armour);
  const sameArmour = armourIds.every((id) => id === armourIds[0]);
  const armourRating = Math.min(
    ...evaluated.map((entry) => entry.sheet.armourRating),
  );
  const armourParts = summed(
    evaluated.flatMap((entry) => armourLines(entry.sheet.lines)),
  );
  const sharedOptions = HULL_OPTIONS.filter((option) =>
    evaluated.every((entry) =>
      entry.hull.hullOptions.some((fitted) => fitted.kind === option.id)
    )
  );
  const thrust = combinedManoeuvre(evaluated, hullTons);
  const jump = weightedFloor(
    evaluated.map((entry, index) => ({
      rating: entry.sheet.jumpRating,
      tons: hullTons[index],
    })),
  );
  const thrustParts = summed(
    evaluated.flatMap((entry) => driveLines(entry.sheet.lines, "manoeuvre")),
  );
  const jumpParts = summed(
    evaluated.flatMap((entry) => driveLines(entry.sheet.lines, "jump")),
  );
  const thrustPower = evaluated.reduce(
    (total, entry) => total + entry.sheet.powerUse.maneuver,
    0,
  );
  const jumpPower = evaluated.reduce(
    (total, entry) => total + entry.sheet.powerUse.jump,
    0,
  );
  const plantIds = evaluated.map((entry) => entry.hull.powerPlant);
  const samePlant = plantIds.every((id) => id === plantIds[0]);
  const plantLabel = samePlant
    ? POWER_PLANTS.find((plant) => plant.id === plantIds[0])?.label ?? "mixed"
    : "mixed";
  const plantParts = summed(
    evaluated.flatMap((entry) => plantLines(entry.sheet.lines)),
  );
  const powerPoints = evaluated.reduce(
    (total, entry) =>
      total + (Number.isFinite(entry.hull.power) ? entry.hull.power : 0),
    0,
  );
  const computers = evaluated.flatMap((entry) => {
    const line = computerLine(entry.sheet.lines);
    return line ? [{ entry, line }] : [];
  }).sort((left, right) =>
    right.line.cost - left.line.cost ||
    (hullLine(right.entry.sheet.lines)?.tons ?? 0) -
      (hullLine(left.entry.sheet.lines)?.tons ?? 0)
  );
  const sensors = evaluated.flatMap((entry) => {
    const line = sensorLine(entry.sheet.lines);
    return line ? [{ entry, line }] : [];
  }).sort((left, right) =>
    right.line.cost - left.line.cost ||
    (hullLine(right.entry.sheet.lines)?.tons ?? 0) -
      (hullLine(left.entry.sheet.lines)?.tons ?? 0)
  );
  const bridges = evaluated.flatMap((entry) => {
    const line = bridgeLine(entry.sheet.lines);
    return line ? [{ entry, line }] : [];
  }).sort((left, right) =>
    right.line.tons - left.line.tons ||
    (hullLine(right.entry.sheet.lines)?.tons ?? 0) -
      (hullLine(left.entry.sheet.lines)?.tons ?? 0)
  );
  const stationLines = evaluated.flatMap((entry) =>
    linesWithRole(entry.sheet.lines, "sensorStation")
  );
  const stationParts = summed(stationLines);
  const stationCount = Math.round(stationParts.tons);
  const components = new Map<string, DesignLine>();
  for (const entry of evaluated) {
    for (const line of entry.sheet.lines) {
      if (!isCombinedApart(line)) addComponent(components, line);
    }
  }
  const armourName = !sameArmour
    ? "mixed armor"
    : armourIds[0] === "none"
    ? ""
    : `${
      ARMOUR.find((armour) => armour.id === armourIds[0])?.label ?? "mixed"
    } ${armourRating}`;
  const sharedOptionLines = new Map<string, DesignLine>(
    sharedOptions.map((option) => {
      const parts = summed(
        evaluated.flatMap((entry) => optionLines(entry.sheet.lines, option.id)),
      );
      const line: DesignLine = {
        role: "hullOption",
        option: option.id,
        name: option.label,
        tons: parts.tons,
        cost: parts.cost,
        ...(parts.power ? { power: parts.power } : {}),
      };
      return [option.id, line];
    }),
  );
  const lines: DesignLine[] = [];
  const emitted = new Set<string>();
  const emitOnce = (key: string, line: DesignLine | undefined) => {
    if (!line || emitted.has(key)) return;
    emitted.add(key);
    lines.push(line);
  };
  for (const entry of evaluated) {
    for (const line of entry.sheet.lines) {
      if (line.role === "hull") {
        emitOnce("hull", {
          role: "hull",
          name: hullName,
          tons: totalTons,
          cost: hullParts.cost,
          power: hullParts.power,
        });
        continue;
      }
      if (line.role === "armour") {
        if (armourName) {
          emitOnce("armour", {
            role: "armour",
            name: armourName,
            tons: armourParts.tons,
            cost: armourParts.cost,
          });
        }
        continue;
      }
      if (line.role === "hullOption") {
        emitOnce(
          line.option ?? line.name,
          line.option ? sharedOptionLines.get(line.option) : undefined,
        );
        continue;
      }
      if (line.role === "manoeuvre") {
        if (thrustParts.tons > 0 || thrustPower > 0) {
          emitOnce("thrust", {
            role: "manoeuvre",
            name: `Manoeuvre drive ${thrust}`,
            tons: thrustParts.tons,
            cost: thrustParts.cost,
            power: thrustPower,
          });
        }
        continue;
      }
      if (line.role === "jump") {
        if (jumpParts.tons > 0 || jumpPower > 0) {
          emitOnce("jump", {
            role: "jump",
            name: `Jump drive ${jump}`,
            tons: jumpParts.tons,
            cost: jumpParts.cost,
            power: jumpPower,
          });
        }
        continue;
      }
      if (line.role === "plant") {
        if (plantParts.tons > 0 || powerPoints > 0) {
          emitOnce("plant", {
            role: "plant",
            name: plantLabel,
            tons: plantParts.tons,
            cost: plantParts.cost,
            power: powerPoints,
          });
        }
        continue;
      }
      if (line.role === "bridge") {
        emitOnce("bridge", bridges[0] ? { ...bridges[0].line } : undefined);
        continue;
      }
      if (line.role === "sensorStation") {
        if (stationCount > 0) {
          emitOnce("sensor-station", {
            role: "sensorStation",
            name: stationCount > 1
              ? `Sensor station x${stationCount}`
              : "Sensor station",
            tons: stationParts.tons,
            cost: stationParts.cost,
          });
        }
        continue;
      }
      if (line.role === "computer") {
        emitOnce(
          "computer",
          computers[0] ? { ...computers[0].line } : undefined,
        );
        continue;
      }
      if (line.role === "sensors") {
        emitOnce("sensors", sensors[0] ? { ...sensors[0].line } : undefined);
        continue;
      }
      emitOnce(line.name, components.get(line.name));
    }
  }
  const orderedLines = orderSheetLines(lines);

  const needed = evaluated.reduce(
    (total, entry) => total + entry.sheet.powerUse.total,
    0,
  );
  const warnings: string[] = [];
  const crewCounts = new Map<string, number>();
  for (const entry of evaluated) {
    for (const member of entry.sheet.crew) {
      crewCounts.set(
        member.role,
        (crewCounts.get(member.role) ?? 0) + member.count,
      );
    }
  }
  const powerUse = {
    base: evaluated.reduce(
      (total, entry) => total + entry.sheet.powerUse.base,
      0,
    ),
    jump: jumpPower,
    maneuver: thrustPower,
    weapons: evaluated.reduce(
      (total, entry) => total + entry.sheet.powerUse.weapons,
      0,
    ),
    sensors: evaluated.reduce(
      (total, entry) => total + entry.sheet.powerUse.sensors,
      0,
    ),
    fittings: evaluated.reduce(
      (total, entry) => total + entry.sheet.powerUse.fittings,
      0,
    ),
    total: needed,
  };
  const sheet: DesignSheet = {
    lines: orderedLines,
    used: round2(
      evaluated.reduce((total, entry) => total + entry.sheet.used, 0),
    ),
    usable: round2(
      evaluated.reduce((total, entry) => total + entry.sheet.usable, 0),
    ),
    cargo: round2(
      evaluated.reduce((total, entry) => total + entry.sheet.cargo, 0),
    ),
    cost: Math.round(
      evaluated.reduce((total, entry) => total + entry.sheet.cost, 0) * 10000,
    ) / 10000,
    hullPoints: evaluated.reduce(
      (total, entry) => total + entry.sheet.hullPoints,
      0,
    ),
    armourRating,
    hardpoints: evaluated.reduce(
      (total, entry) => total + entry.sheet.hardpoints,
      0,
    ),
    hardpointsUsed: evaluated.reduce(
      (total, entry) => total + entry.sheet.hardpointsUsed,
      0,
    ),
    jumpFuel: round2(
      evaluated.reduce((total, entry) => total + entry.sheet.jumpFuel, 0),
    ),
    powerFuel: round2(
      evaluated.reduce((total, entry) => total + entry.sheet.powerFuel, 0),
    ),
    fuelMinimum: evaluated.reduce(
      (total, entry) => total + entry.sheet.fuelMinimum,
      0,
    ),
    fuelCapacity: evaluated.reduce(
      (total, entry) => total + entry.sheet.fuelCapacity,
      0,
    ),
    powerPlantTons: round2(plantParts.tons),
    powerRequired: needed,
    powerUse,
    thrustRating: thrust,
    jumpRating: jump,
    crew: [...crewCounts.entries()].sort((left, right) =>
      CREW_ORDER.indexOf(left[0]) - CREW_ORDER.indexOf(right[0])
    ).filter((entry) => entry[1] > 0).map(([role, count]) => ({ role, count })),
    errors: [],
    warnings,
  };
  const computer = computers[0]?.entry.hull;
  const sensor = sensors[0]?.entry.hull;
  const bridge = bridges[0]?.entry.hull;
  const design: AdvancedDesign = {
    ...hulls[0],
    id: `combined-${hulls[0]?.id ?? "sheet"}`,
    name: hulls[0]?.name.trim()
      ? `${hulls[0].name.trim()} Combined`
      : "Combined",
    hullTons: totalTons,
    configuration,
    hullType,
    armour: sameArmour ? armourIds[0] : hulls[0].armour,
    armourRating,
    thrust,
    jump,
    power: powerPoints,
    powerPlant: samePlant ? plantIds[0] : hulls[0].powerPlant,
    computer: computer?.computer ?? hulls[0].computer,
    computerType: computer?.computerType ?? hulls[0].computerType,
    sensors: sensor?.sensors ?? hulls[0].sensors,
    bridge: bridge?.bridge ?? hulls[0].bridge,
    holographicControls: bridge?.holographicControls ??
      hulls[0].holographicControls ?? false,
    sensorStations: evaluated.reduce(
      (total, entry) =>
        total + Math.max(0, Math.trunc(entry.hull.sensorStations) || 0),
      0,
    ),
    brigs: evaluated.reduce(
      (total, entry) => total + Math.max(0, Math.trunc(entry.hull.brigs) || 0),
      0,
    ),
    emergencyLowBerths: evaluated.reduce(
      (total, entry) =>
        total + Math.max(0, Math.trunc(entry.hull.emergencyLowBerths) || 0),
      0,
    ),
    hullOptions: sharedOptions.map((option) => ({
      id: option.id,
      kind: option.id,
    })),
    breakawayHulls: [],
    standardDesign: false,
  };
  return { design, sheet };
}

/** Breakaway Hull, plus the joined hull names. A repeated hull is written once with its count. */
function breakawayContents(
  ids: readonly string[],
  catalog: readonly AdvancedDesign[],
): string {
  const counts = new Map<string, number>();
  const order: string[] = [];
  for (const id of ids) {
    const name = catalog.find((row) => row.id === id)?.name.trim();
    if (!name) continue;
    if (!counts.has(name)) order.push(name);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  if (order.length === 0) return "Breakaway Hull";
  const parts = order.map((name) => {
    const count = counts.get(name) ?? 0;
    return count > 1 ? `${name} x${count}` : name;
  });
  return `Breakaway Hull (${parts.join(", ")})`;
}

export function nameBreakawayHulls(
  sheet: DesignSheet,
  ids: readonly string[],
  catalog: readonly AdvancedDesign[],
): DesignSheet {
  const label = breakawayContents(ids, catalog);
  if (label === "Breakaway Hull") return sheet;
  return {
    ...sheet,
    lines: sheet.lines.map((line) =>
      line.role === "hullOption" && line.option === "breakaway" &&
        line.name === "Breakaway Hull"
        ? { ...line, name: label }
        : line
    ),
  };
}

/** Stat blocks for HTML export: combined hull, the ship itself, then each distinct joined hull. */
export function exportStatBlocks(
  design: AdvancedDesign,
  catalog: readonly AdvancedDesign[] = [],
): { design: AdvancedDesign; sheet: DesignSheet }[] {
  const joined = design.hullType !== "module" &&
      design.hullOptions.some((option) => option.kind === "breakaway")
    ? design.breakawayHulls ?? []
    : [];
  const hulls = joined.flatMap((id) => {
    const found = catalog.find((row) => row.id === id);
    return found ? [found] : [];
  });
  const known = new Map<string, DesignSheet>();
  const sheetFor = (hull: AdvancedDesign): DesignSheet => {
    const cached = known.get(hull.id);
    if (cached) return cached;
    const sheet = evaluateDesign(hull, catalog);
    known.set(hull.id, sheet);
    return sheet;
  };
  const primarySheet = evaluateDesign(design, catalog);
  const primary = {
    design,
    sheet: nameBreakawayHulls(primarySheet, joined, catalog),
  };
  if (hulls.length === 0) return [primary];
  const unique: AdvancedDesign[] = [];
  const seen = new Set<string>();
  for (const hull of hulls) {
    if (seen.has(hull.id)) continue;
    seen.add(hull.id);
    unique.push(hull);
  }
  const combined = combinedBreakaway([design, ...hulls], catalog, [
    primarySheet,
    ...hulls.map((hull) => sheetFor(hull)),
  ]);
  return [
    {
      design: combined.design,
      sheet: nameBreakawayHulls(combined.sheet, joined, catalog),
    },
    primary,
    ...unique.map((hull) => ({
      design: hull,
      sheet: nameBreakawayHulls(
        sheetFor(hull),
        hull.breakawayHulls ?? [],
        catalog,
      ),
    })),
  ];
}

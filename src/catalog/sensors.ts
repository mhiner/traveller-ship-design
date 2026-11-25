/** Extra sensor stations. Each is 1 ton and MCr 0.5. A hull above this includes them in the bridge. */
export const SENSOR_STATION_MAX_HULL = 7500;
export const SENSOR_STATION_TONS = 1;
export const SENSOR_STATION_COST = 0.5;

export const SENSORS = [
  { id: "basic", label: "Basic", tl: 8, tons: 0, cost: 0, power: 0 },
  { id: "civilian", label: "Civilian", tl: 9, tons: 1, cost: 3, power: 1 },
  { id: "military", label: "Military", tl: 10, tons: 2, cost: 4.1, power: 2 },
  { id: "improved", label: "Improved", tl: 12, tons: 3, cost: 4.3, power: 4 },
  { id: "advanced", label: "Advanced", tl: 15, tons: 5, cost: 5.3, power: 6 },
] as const;

export type SensorId = (typeof SENSORS)[number]["id"];
/** High Guard sensor options. Mineral detection lists no power requirement. */
export const ADDITIONAL_SENSORS = [
  { id: "life", label: "Life Scanner", tl: 12, tons: 1, cost: 2, power: 1 },
  {
    id: "lifeAnalysis",
    label: "Life Scanner Analysis Suite",
    tl: 14,
    tons: 1,
    cost: 4,
    power: 1,
  },
  {
    id: "shallow",
    label: "Shallow Penetration Suite",
    tl: 10,
    tons: 10,
    cost: 5,
    power: 1,
  },
  {
    id: "improvedSignal",
    label: "Improved Signal Processing",
    tl: 11,
    tons: 1,
    cost: 4,
    power: 1,
  },
  {
    id: "enhancedSignal",
    label: "Enhanced Signal Processing",
    tl: 13,
    tons: 2,
    cost: 8,
    power: 2,
  },
  {
    id: "mineral",
    label: "Mineral Detection Suite",
    tl: 12,
    tons: 1,
    cost: 5,
    power: 0,
  },
  {
    id: "countermeasures",
    label: "Countermeasures Suite",
    tl: 13,
    tons: 2,
    cost: 4,
    power: 1,
  },
  {
    id: "militaryCountermeasures",
    label: "Military Countermeasures Suite",
    tl: 15,
    tons: 15,
    cost: 28,
    power: 2,
  },
  /** Chosen tons. MCr1 per ton and one power. Each ton scans 20 tons of a target per hour. */
  {
    id: "deep",
    label: "Deep Penetration Scanners",
    tl: 13,
    tons: 0,
    cost: 0,
    power: 1,
  },
  /** Adds twice the sensor suite, so the suite's tonnage, cost, and power total three times. Improved or Advanced only, on more than 5,000 tons. */
  {
    id: "distributed",
    label: "Distributed Arrays",
    tl: 11,
    tons: 0,
    cost: 0,
    power: 0,
  },
  /** One percent of the hull, at least one ton, at MCr1 per ton. */
  {
    id: "extension",
    label: "Extension Net",
    tl: 10,
    tons: 0,
    cost: 0,
    power: 0,
  },
  /** Adds twice the suite's tonnage and power, and four times its cost, so the suite totals three times the tonnage and power and five times the cost. */
  {
    id: "rapid",
    label: "Rapid-deployment Extended Arrays",
    tl: 11,
    tons: 0,
    cost: 0,
    power: 0,
  },
] as const;

/** Tons of a target scanned in an hour by one ton of deep penetration scanners. */
export const DEEP_SCAN_TONS_PER_HOUR = 20;

/** One percent of the hull, and at least one ton. */
export function extensionNetTons(hullTons: number): number {
  const hull = Number.isFinite(hullTons)
    ? Math.max(0, Math.round(hullTons))
    : 0;
  return Math.max(1, hull / 100);
}

export function deepScanNote(tons: number): string {
  if (!(tons > 0)) return "";
  return `scan ${
    Math.round(tons * DEEP_SCAN_TONS_PER_HOUR).toLocaleString("en-US")
  } tons/hr`;
}

/** Tons, cost, and power of one additional sensor. Suite-scaled arrays report the added share, which is what the sheet lists beside the sensor suite. */
export function additionalSensorQuote(
  kindId: string,
  ratedTons: number,
  hullTons: number,
  suite: { tons: number; cost: number; power: number },
): { tons: number; cost: number; power: number } {
  const round2 = (value: number) => Math.round(value * 100) / 100;
  if (kindId === "deep") {
    const tons = Math.max(
      1,
      Math.round(Number.isFinite(ratedTons) ? ratedTons : 1),
    );
    return { tons, cost: tons, power: 1 };
  }
  if (kindId === "extension") {
    const tons = extensionNetTons(hullTons);
    return { tons, cost: round2(tons), power: 0 };
  }
  if (kindId === "distributed") {
    return {
      tons: round2(suite.tons * 2),
      cost: round2(suite.cost * 2),
      power: suite.power * 2,
    };
  }
  if (kindId === "rapid") {
    return {
      tons: round2(suite.tons * 2),
      cost: round2(suite.cost * 4),
      power: suite.power * 2,
    };
  }
  const kind = ADDITIONAL_SENSORS.find((row) => row.id === kindId);
  return {
    tons: kind?.tons ?? 0,
    cost: kind?.cost ?? 0,
    power: kind?.power ?? 0,
  };
}

export type AdditionalSensorId = (typeof ADDITIONAL_SENSORS)[number]["id"];

export interface AdditionalSensor {
  id: string;
  kind: AdditionalSensorId;
  tons: number;
}

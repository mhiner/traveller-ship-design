/** Rooms a design can offer. Doubles are a subset of standard staterooms. */

export interface BerthSupply {
  luxury: number;
  high: number;
  single: number;
  double: number;
  low: number;
  emergency: number;
}

/** Rooms a design records, before anyone is seated. */
export interface BerthDesign {
  staterooms?: number;
  doubleStaterooms?: number;
  highStaterooms?: number;
  luxuryStaterooms?: number;
  lowBerths?: number;
  emergencyLowBerths?: number;
}

/** high and middle take a whole room. basic takes a bunk. low takes a berth. */
export type Passage = "high" | "middle" | "basic" | "low" | "crew";

/** Whether the people fit, and how many double bunks remain. */
export interface BerthReport {
  fits: boolean;
  reason: string;
  doubles: number;
  doubleBunksFree: number;
  summary: string;
}

/** Passage grades are seated in this order, highest claim first. */
const ORDER: Passage[] = ["high", "middle", "basic", "low", "crew"];

/** A non-negative whole count. A missing or non-finite value becomes 0. */
function whole(value: number | undefined): number {
  const count = Math.trunc(Number(value));
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}

/** A stored passage with no grade counts as middle. */
export function passageGrade(value: unknown): Passage {
  const text = String(value ?? "").trim().toLowerCase();
  if (text.startsWith("high")) return "high";
  if (text.startsWith("basic")) return "basic";
  if (text.startsWith("low")) return "low";
  if (text.startsWith("crew")) return "crew";
  return "middle";
}

/** Rooms on a design. Double staterooms are capped by the stateroom count, and the remainder are singles. */
export function berthsOf(design: BerthDesign | null | undefined): BerthSupply {
  const staterooms = whole(design?.staterooms);
  const doubles = Math.min(staterooms, whole(design?.doubleStaterooms));
  return {
    luxury: whole(design?.luxuryStaterooms),
    high: whole(design?.highStaterooms),
    single: staterooms - doubles,
    double: doubles,
    low: whole(design?.lowBerths),
    emergency: whole(design?.emergencyLowBerths)
  };
}

/** Adds copies of extra rooms onto a supply. Quantity is truncated to a whole count. */
export function addBerths(base: BerthSupply, extra: BerthSupply, quantity = 1): BerthSupply {
  const copies = whole(quantity);
  const sum = { ...base };
  for (const key of Object.keys(sum) as (keyof BerthSupply)[]) {
    sum[key] += extra[key] * copies;
  }
  return sum;
}

/** The failure sentence for a grade that found no room. */
function reasonFor(grade: Passage): string {
  if (grade === "high") return "No stateroom is free for a high passenger.";
  if (grade === "middle") return "No stateroom is free for a middle passenger.";
  if (grade === "basic") return "No bunk is free for a basic passenger.";
  if (grade === "low") return "No low berth is free.";
  return "No bunk is free for crew.";
}

/** The doubles line on a berth report. */
function summary(doubles: number, bunksFree: number): string {
  const rooms = doubles === 1 ? "1 room" : `${doubles} rooms`;
  const bunks = bunksFree === 1 ? "1 bunk free" : `${bunksFree} bunks free`;
  return `Doubles: ${rooms}, ${bunks}.`;
}

/**
 * Places people in grade order.
 * A high or middle passenger takes a whole double room.
 * Two basic passengers share one. Crew use the bunks that remain.
 */
export function assignBerths(supply: BerthSupply, people: readonly Passage[]): BerthReport {
  let luxury = supply.luxury;
  let high = supply.high;
  let single = supply.single;
  let doubles = supply.double;
  // A bunk left open in a double that a basic passenger or a crew member already took.
  let besideBasic = 0;
  let besideCrew = 0;
  let low = supply.low;
  // Each emergency low berth holds four people.
  let emergency = supply.emergency * 4;

  /** Seats one person of this grade and updates the rooms still open. */
  const take = (grade: Passage): boolean => {
    if (grade === "high") {
      if (luxury > 0) {
        luxury -= 1;
        return true;
      }
      if (high > 0) {
        high -= 1;
        return true;
      }
      if (single > 0) {
        single -= 1;
        return true;
      }
      if (doubles > 0) {
        doubles -= 1;
        return true;
      }
      return false;
    }
    if (grade === "middle") {
      if (single > 0) {
        single -= 1;
        return true;
      }
      if (doubles > 0) {
        doubles -= 1;
        return true;
      }
      if (high > 0) {
        high -= 1;
        return true;
      }
      if (luxury > 0) {
        luxury -= 1;
        return true;
      }
      return false;
    }
    if (grade === "basic") {
      if (besideBasic > 0) {
        besideBasic -= 1;
        return true;
      }
      if (doubles > 0) {
        doubles -= 1;
        besideBasic += 1;
        return true;
      }
      if (single > 0) {
        single -= 1;
        return true;
      }
      return false;
    }
    if (grade === "low") {
      if (low > 0) {
        low -= 1;
        return true;
      }
      if (emergency > 0) {
        emergency -= 1;
        return true;
      }
      return false;
    }
    if (single > 0) {
      single -= 1;
      return true;
    }
    if (besideCrew > 0) {
      besideCrew -= 1;
      return true;
    }
    if (doubles > 0) {
      doubles -= 1;
      besideCrew += 1;
      return true;
    }
    // Crew may take the bunk a basic passenger left open.
    if (besideBasic > 0) {
      besideBasic -= 1;
      return true;
    }
    return false;
  };

  for (const grade of ORDER) {
    const count = people.filter((person) => person === grade).length;
    for (let index = 0; index < count; index += 1) {
      if (!take(grade)) {
        const reason = reasonFor(grade);
        const doubleBunksFree = doubles * 2 + besideBasic + besideCrew;
        return {
          fits: false,
          reason,
          doubles: supply.double,
          doubleBunksFree,
          summary: `${summary(supply.double, doubleBunksFree)} ${reason}`
        };
      }
    }
  }
  const doubleBunksFree = doubles * 2 + besideBasic + besideCrew;
  return {
    fits: true,
    reason: "",
    doubles: supply.double,
    doubleBunksFree,
    summary: summary(supply.double, doubleBunksFree)
  };
}

/** How many more people of this grade fit with the people already aboard. */
export function seatsOpen(
  supply: BerthSupply,
  aboard: readonly Passage[],
  grade: Passage
): number {
  const next = [...aboard];
  let open = 0;
  while (assignBerths(supply, [...next, grade]).fits) {
    next.push(grade);
    open += 1;
    // Stop so a supply that always fits cannot loop.
    if (open > 10000) break;
  }
  return open;
}

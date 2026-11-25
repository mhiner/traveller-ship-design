/** Mongoose freight lots and TravelerTrade mail for one origin and destination. */

import type { Dice } from "./market.ts";

/** One world on a freight route. */
export interface FreightWorld {
  name: string;
  sector: string;
  hex: string;
  population: number;
  port: string;
  /** Tech level digit from the UWP. */
  tech: number;
  /** "Amber", "Red", or "". */
  zone: string;
}

/** One freight contract or one mail container. */
export interface FreightLot {
  id: string;
  kind: "major" | "minor" | "incidental" | "mail";
  name: string;
  tons: number;
  pricePerTon: number;
}

/** The generated freight list for one origin and destination. */
export interface FreightRoll {
  originSector: string;
  originHex: string;
  originName: string;
  destSector: string;
  destHex: string;
  destName: string;
  parsecs: number;
  trafficDm: number;
  lots: FreightLot[];
}

/** Crew facts that modify the mail roll. */
export interface MailCrew {
  armed: boolean;
  /** Navy or Scout rank. Unreadable crew stay at 0. */
  rank: number;
  socDm: number;
}

/** Credits paid per ton of freight, by the jump in parsecs. */
const PRICE_PER_TON: Record<number, number> = {
  1: 1000,
  2: 1600,
  3: 2600,
  4: 4400,
  5: 8500,
  6: 32000
};

/** Tons in one mail container. */
const MAIL_TONS = 5;
/** Credits paid for one mail container. */
const MAIL_FEE = 25000;

/** Tech level from a UWP such as A788899-C. Unknown digits return null. */
export function techFromUwp(uwp: string): number | null {
  const match = /^\w{7}-(\w)$/.exec(uwp.trim().toUpperCase());
  if (!match) return null;
  const digit = match[1];
  if (!digit || digit === "?") return null;
  const value = Number.parseInt(digit, 16);
  return Number.isNaN(value) ? null : value;
}

/** Population, starport, tech, and zone for one world. */
export function freightWorldDm(world: FreightWorld): number {
  let dm = 0;
  if (world.population <= 1) dm -= 4;
  else if (world.population === 6 || world.population === 7) dm += 2;
  else if (world.population >= 8) dm += 4;

  switch (world.port.toUpperCase()) {
    case "A":
      dm += 2;
      break;
    case "B":
      dm += 1;
      break;
    case "E":
      dm -= 1;
      break;
    case "X":
      dm -= 3;
      break;
    default:
      break;
  }

  if (world.tech <= 6) dm -= 1;
  else if (world.tech >= 9) dm += 2;

  const zone = world.zone.toLowerCase();
  if (zone === "amber") dm -= 2;
  else if (zone === "red") dm -= 6;
  return dm;
}

/** Both worlds, then one less per parsec after the first. */
export function freightTrafficDm(
  origin: FreightWorld,
  destination: FreightWorld,
  parsecs: number
): number {
  return freightWorldDm(origin) + freightWorldDm(destination) - (parsecs - 1);
}

/** How many lots a 2d6 freight total produces. One or less is none. */
export function freightTrafficDice(total: number): number {
  if (total <= 1) return 0;
  if (total <= 3) return 1;
  if (total <= 5) return 2;
  if (total <= 8) return 3;
  if (total <= 11) return 4;
  if (total <= 14) return 5;
  if (total <= 16) return 6;
  if (total === 17) return 7;
  if (total === 18) return 8;
  if (total === 19) return 9;
  return 10;
}

/** Mail's modifier from the freight traffic DM. */
export function mailBandDm(trafficDm: number): number {
  if (trafficDm <= -10) return -2;
  if (trafficDm <= -5) return -1;
  if (trafficDm <= 4) return 0;
  if (trafficDm <= 9) return 1;
  return 2;
}

/**
 * Major, minor, and incidental lots, then one mail row per container.
 * Parsecs outside 1–6 produce no list. A lot is the whole contract.
 */
export function listFreight(
  origin: FreightWorld,
  destination: FreightWorld,
  parsecs: number,
  mail: MailCrew,
  dice: Dice,
  ids: () => string
): FreightRoll | null {
  const distance = Math.trunc(parsecs);
  if (distance < 1 || distance > 6) return null;
  const trafficDm = freightTrafficDm(origin, destination, distance);
  const price = PRICE_PER_TON[distance] ?? 0;
  const lots: FreightLot[] = [];
  // Major lots use a traffic DM four lower. Tons per lot are 1d6 times 10, 5, or 1.
  addLots(lots, "major", "Major Lot", trafficDm - 4, 10, price, dice, ids);
  addLots(lots, "minor", "Minor Lot", trafficDm, 5, price, dice, ids);
  addLots(lots, "incidental", "Incidental Lot", trafficDm, 1, price, dice, ids);
  const containers = mailContainers(trafficDm, origin.tech, mail, dice);
  for (let index = 0; index < containers; index += 1) {
    lots.push({
      id: ids(),
      kind: "mail",
      name: "Mail",
      tons: MAIL_TONS,
      pricePerTon: MAIL_FEE / MAIL_TONS
    });
  }
  return {
    originSector: origin.sector,
    originHex: origin.hex,
    originName: origin.name,
    destSector: destination.sector,
    destHex: destination.hex,
    destName: destination.name,
    parsecs: distance,
    trafficDm,
    lots
  };
}

/** Rolls how many lots appear, then one tonnage die for each lot. */
function addLots(
  lots: FreightLot[],
  kind: FreightLot["kind"],
  name: string,
  trafficDm: number,
  tonsPerDie: number,
  pricePerTon: number,
  dice: Dice,
  ids: () => string
): void {
  const traffic = dice.die(6) + dice.die(6) + trafficDm;
  const count = freightTrafficDice(traffic);
  let lotsToAdd = 0;
  for (let die = 0; die < count; die += 1) lotsToAdd += dice.die(6);
  for (let index = 0; index < lotsToAdd; index += 1) {
    lots.push({
      id: ids(),
      kind,
      name,
      tons: dice.die(6) * tonsPerDie,
      pricePerTon
    });
  }
}

/** Mail containers on offer. The check needs 12 or more, and the result is 1d6 containers. */
function mailContainers( trafficDm: number, originTech: number, mail: MailCrew, dice: Dice ): number {
  // Armed ship +2, origin tech 5 or less is −4, then rank and Social Standing.
  const total = dice.die(6) + dice.die(6)
    + mailBandDm(trafficDm)
    + (mail.armed ? 2 : 0)
    + (originTech <= 5 ? -4 : 0)
    + mail.rank
    + mail.socDm;
  if (total < 12) return 0;
  return dice.die(6);
}

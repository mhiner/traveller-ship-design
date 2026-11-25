/** World-tab trade list for one system. Lots are data, not cargo. */

export interface Dice {
  /** One die, from 1 to `faces`. */
  die(faces: number): number;
}

/** One row of the trade-goods catalogue. */
export interface CatalogueGood {
  name: string;
  img: string;
  tons: string;
  price: number;
  availability: string;
  purchaseDM: string;
  saleDM: string;
  illegal: boolean;
}

/** The world the trade list is rolled for. */
export interface MarketWorld {
  name: string;
  sector: string;
  hex: string;
  /** UWP population digit. */
  population: number;
  /** Starport letter. */
  port: string;
  /** Trade codes as stored on a world, for example "Ag, In". */
  codes: string;
  /** "Amber", "Red", or "". */
  zone: string;
}

/** One generated lot: tons available and the per-ton buy and sell prices. */
export interface MarketLot {
  id: string;
  name: string;
  img: string;
  tons: number;
  basePrice: number;
  purchasePerTon: number;
  salePerTon: number;
  illegal: boolean;
}

/** The generated trade list for one world. */
export interface MarketList {
  sector: string;
  hex: string;
  name: string;
  lots: MarketLot[];
}

/** A trade good already in the ship's hold. */
export interface CarriedGood {
  name: string;
  img: string;
  price: number;
  purchaseDM: string;
  saleDM: string;
  illegal: boolean;
  salePrice: number;
  speculative: boolean;
}

/** Broker skill assumed for the world's own broker in the price check. */
const LOCAL_BROKER = 2;
/** Trade-good name rolled from the starport, apart from the catalogue. */
const SPARE_NAME = "Spare Parts";

/** Purchase price as a percent of base, keyed by the modified 3d6 total. */
const PURCHASE_PERCENT: Record<number, number> = {
  [-3]: 300,
  [-2]: 250,
  [-1]: 200,
  0: 175,
  1: 150,
  2: 135,
  3: 125,
  4: 120,
  5: 115,
  6: 110,
  7: 105,
  8: 100,
  9: 95,
  10: 90,
  11: 85,
  12: 80,
  13: 75,
  14: 70,
  15: 65,
  16: 60,
  17: 55,
  18: 50,
  19: 45,
  20: 40,
  21: 35,
  22: 30,
  23: 25,
  24: 20,
  25: 15
};

/** Sale price as a percent of base, keyed by the modified 3d6 total. */
const SALE_PERCENT: Record<number, number> = {
  [-3]: 10,
  [-2]: 20,
  [-1]: 30,
  0: 40,
  1: 45,
  2: 50,
  3: 55,
  4: 60,
  5: 65,
  6: 70,
  7: 75,
  8: 80,
  9: 85,
  10: 90,
  11: 100,
  12: 105,
  13: 110,
  14: 115,
  15: 120,
  16: 125,
  17: 130,
  18: 140,
  19: 150,
  20: 160,
  21: 175,
  22: 200,
  23: 250,
  24: 300,
  25: 400
};

/** Sector and hex stored on bought cargo. */
export function placeKey(sector: string, hex: string): string {
  return `${sector}|${hex}`;
}

/** Purchase percent from the world-tab chart. */
export function purchasePercent(total: number): number {
  if (total < -3) return 300;
  if (total > 25) return 15;
  return PURCHASE_PERCENT[total] ?? 100;
}

/** Sale percent from the world-tab chart. */
export function salePercent(total: number): number {
  if (total < -3) return 10;
  if (total > 25) return 400;
  return SALE_PERCENT[total] ?? 100;
}

/** Credits after a percent modifier, rounded to the nearest credit. */
export function priced(base: number, percent: number): number {
  return Math.round((Number(base) * Number(percent)) / 100);
}

/** The largest listed modifier whose code or zone matches. */
export function highestModifier(codes: string, zone: string, modifiers: string): number {
  let best = 0;
  for (const code of modifiers.split(",")) {
    const [name, raw] = code.trim().split(" ");
    const value = Number.parseInt(raw ?? "", 10);
    if (!name || Number.isNaN(value)) continue;
    if (codes.indexOf(name) > -1 || zone === name) {
      if (value > best) best = value;
    }
  }
  return best;
}

/** Population changes the dice inside a tonnage formula. A formula without dice is unchanged. */
export function withPopulation(formula: string, population: number): string {
  let modifier = "";
  if (population <= 3) modifier = "- 3";
  else if (population >= 9) modifier = "+ 3";
  if (!modifier || !/D6/i.test(formula)) return formula;
  return formula.replace(/([0-9]+D6)/gi, `($1 ${modifier})`);
}

/** Evaluate a dice formula such as `(2D6 - 3)*10` or `2D3`. */
export function rollFormula(formula: string, dice: Dice): number {
  const text = formula.replace(/\s+/g, "");
  let index = 0;

  /** A sum or difference of terms. */
  const parseExpr = (): number => {
    let value = parseTerm();
    while (text[index] === "+" || text[index] === "-") {
      const op = text[index];
      index += 1;
      const right = parseTerm();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  };

  /** A product of factors. The letters x and the sign × both multiply. */
  const parseTerm = (): number => {
    let value = parseFactor();
    while (text[index] === "*" || text[index] === "x" || text[index] === "X" || text[index] === "×") {
      index += 1;
      value *= parseFactor();
    }
    return value;
  };

  /** A parenthesized expression, a dice roll, or a plain number. */
  const parseFactor = (): number => {
    if (text[index] === "(") {
      index += 1;
      const value = parseExpr();
      if (text[index] === ")") index += 1;
      return value;
    }
    const match = /^(\d+)/.exec(text.slice(index));
    if (!match) return 0;
    index += match[1].length;
    const count = Number(match[1]);
    if (text[index] === "d" || text[index] === "D") {
      index += 1;
      const sidesMatch = /^(\d+)/.exec(text.slice(index));
      // A die token with an absent face count is a d6.
      const sides = sidesMatch ? Number(sidesMatch[1]) : 6;
      if (sidesMatch) index += sidesMatch[1].length;
      let total = 0;
      for (let face = 0; face < count; face += 1) total += dice.die(sides);
      return total;
    }
    return count;
  };

  if (!text) return 0;
  return parseExpr();
}

/** Whether the world's trade codes include one of the good's availability codes. All matches every world. */
function available(good: CatalogueGood, codes: string): boolean {
  if (good.availability.includes("All")) return true;
  for (const token of good.availability.split(", ")) {
    if (token && codes.includes(token)) return true;
  }
  return false;
}

/** Buy and sell prices for one lot. Illegal goods roll Streetwise. Legal goods roll Broker. */
function quote(
  good: CatalogueGood,
  world: MarketWorld,
  broker: number,
  streetwise: number,
  dice: Dice,
  ids: () => string,
  tons: number
): MarketLot {
  const skill = good.illegal ? streetwise : broker;
  // 3d6 plus skill, against a local broker of skill 2.
  const check = rollFormula("3d6", dice) + skill - LOCAL_BROKER;
  // Purchase DM is the world's purchase modifier minus its sale modifier.
  const purchaseDM = highestModifier(world.codes, world.zone, good.purchaseDM) -
    highestModifier(world.codes, world.zone, good.saleDM);
  const saleDM = highestModifier(world.codes, world.zone, good.saleDM) -
    highestModifier(world.codes, world.zone, good.purchaseDM);
  return {
    id: ids(),
    name: good.name,
    img: good.img,
    tons,
    basePrice: good.price,
    purchasePerTon: priced(good.price, purchasePercent(check + purchaseDM)),
    salePerTon: priced(good.price, salePercent(check + saleDM)),
    illegal: good.illegal
  };
}

/** Stacks tons onto an existing lot of the same name. The first price quote is kept. */
function addLot(lots: MarketLot[], lot: MarketLot): void {
  const existing = lots.find((row) => row.name === lot.name);
  if (!existing) {
    lots.push(lot);
    return;
  }
  existing.tons += lot.tons;
}

/** A legal catalogue good for the extra population lots. The search stops after 24 draws. */
function drawExtra(goods: readonly CatalogueGood[], dice: Dice): CatalogueGood | null {
  if (goods.length === 0) return null;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const good = goods[dice.die(goods.length) - 1];
    // Population extras are legal catalogue goods. Spare parts come from the starport roll.
    if (good && !good.illegal && good.name !== SPARE_NAME) return good;
  }
  return null;
}

/** Spare-parts tonnage dice for starports A through E. */
function spareFormula(port: string): string | null {
  switch (port.toUpperCase()) {
    case "A":
      return "8D6";
    case "B":
      return "4D6";
    case "C":
      return "2D6";
    case "D":
      return "2D3";
    case "E":
      return "1D3";
    default:
      return null;
  }
}

/**
 * Available goods, then one extra per population digit.
 * Illegal goods are left out. A zero tonnage roll is still listed.
 * Spare parts follow the starport.
 */
export function listMarket(
  goods: readonly CatalogueGood[],
  world: MarketWorld,
  broker: number,
  streetwise: number,
  dice: Dice,
  ids: () => string
): MarketList {
  const lots: MarketLot[] = [];
  const catalogue = goods.filter((good) => good.name !== SPARE_NAME && !good.illegal);

  for (const good of catalogue) {
    if (!available(good, world.codes)) continue;
    const rolled = rollFormula(withPopulation(good.tons, world.population), dice);
    const lot = quote(good, world, broker, streetwise, dice, ids, Math.max(0, rolled));
    addLot(lots, lot);
  }

  const population = Math.max(0, Math.trunc(world.population));
  for (let extra = 0; extra < population; extra += 1) {
    const good = drawExtra(goods, dice);
    if (!good) continue;
    const rolled = rollFormula(withPopulation(good.tons, world.population), dice);
    addLot(lots, quote(good, world, broker, streetwise, dice, ids, Math.max(0, rolled)));
  }

  const formula = spareFormula(world.port);
  if (formula) {
    const rolled = rollFormula(formula, dice);
    // Spare-part tons are the starport roll times one lot per three population digits.
    const tons = rolled * Math.trunc(population / 3);
    if (tons > 0) {
      // Spare parts buy at Cr100,000 per ton and sell at Cr50,000.
      addLot(lots, {
        id: ids(),
        name: SPARE_NAME,
        img: "systems/mgt2e/icons/cargo/spare_parts.svg",
        tons,
        basePrice: 100000,
        purchasePerTon: 100000,
        salePerTon: 50000,
        illegal: false
      });
    }
  }

  return {
    sector: world.sector,
    hex: world.hex,
    name: world.name,
    lots
  };
}

/**
 * Adds a sale price for each carried trade good the generated list left out.
 * An existing name keeps its price. New rows have no tons for sale.
 */
export function appendCarriedLots(
  list: MarketList,
  carried: readonly CarriedGood[],
  goods: readonly CatalogueGood[],
  world: MarketWorld | null,
  broker: number,
  streetwise: number,
  dice: Dice,
  ids: () => string
): MarketList {
  const lots = [...list.lots];
  for (const row of carried) {
    const name = row.name.trim();
    if (!name || lots.some((lot) => lot.name === name)) continue;
    const known = goods.find((good) => good.name === name);
    // A carried row is listed when it is a catalogue good, a speculative lot, or already has a sale price.
    const trade = Boolean(known) || row.speculative || row.salePrice > 0;
    if (!trade) continue;
    if (name === SPARE_NAME) {
      lots.push({
        id: ids(),
        name,
        img: row.img || "systems/mgt2e/icons/cargo/spare_parts.svg",
        tons: 0,
        basePrice: 100000,
        purchasePerTon: 100000,
        salePerTon: 50000,
        illegal: false
      });
      continue;
    }
    const base = known?.price || row.price;
    // With no base price or no world, the carried sale price is copied through.
    if (!(base > 0) || !world) {
      if (!(row.salePrice > 0)) continue;
      lots.push({
        id: ids(),
        name,
        img: row.img || known?.img || "icons/svg/item-bag.svg",
        tons: 0,
        basePrice: row.price || row.salePrice,
        purchasePerTon: row.salePrice,
        salePerTon: row.salePrice,
        illegal: known?.illegal ?? row.illegal
      });
      continue;
    }
    const good = known ?? {
      name,
      img: row.img || "icons/svg/item-bag.svg",
      tons: "0",
      price: row.price,
      availability: "All",
      purchaseDM: row.purchaseDM,
      saleDM: row.saleDM,
      illegal: row.illegal
    };
    const lot = quote(good, world, broker, streetwise, dice, ids, 0);
    if (row.img) lot.img = row.img;
    lots.push(lot);
  }
  return { ...list, lots };
}

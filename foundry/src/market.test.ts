import { assertEquals } from "@std/assert";
import type { CatalogueGood, Dice, MarketWorld } from "./market.ts";
import {
  appendCarriedLots,
  highestModifier,
  listMarket,
  placeKey,
  priced,
  purchasePercent,
  rollFormula,
  salePercent,
  withPopulation
} from "./market.ts";

function scripted(faces: number[]): Dice {
  let index = 0;
  return {
    die() {
      const face = faces[index] ?? 1;
      index += 1;
      return face;
    }
  };
}

function ids(): () => string {
  let next = 0;
  return () => {
    next += 1;
    return `lot-${next}`;
  };
}

function good(patch: Partial<CatalogueGood> = {}): CatalogueGood {
  return {
    name: "Textiles",
    img: "icons/svg/item-bag.svg",
    tons: "1D6",
    price: 3000,
    availability: "All",
    purchaseDM: "Ag 2, In 5",
    saleDM: "Hi 1",
    illegal: false,
    ...patch
  };
}

const world: MarketWorld = {
  name: "Regina",
  sector: "Spinward Marches",
  hex: "1910",
  population: 8,
  port: "A",
  codes: "In, Hi",
  zone: ""
};

Deno.test("the world-tab percent chart prices a purchase and a sale", () => {
  assertEquals(purchasePercent(-4), 300);
  assertEquals(purchasePercent(8), 100);
  assertEquals(purchasePercent(12), 80);
  assertEquals(purchasePercent(26), 15);
  assertEquals(salePercent(-4), 10);
  assertEquals(salePercent(4), 60);
  assertEquals(salePercent(16), 125);
  assertEquals(salePercent(26), 400);
  assertEquals(priced(3000, 80), 2400);
});

Deno.test("trade-code modifiers keep the single highest match", () => {
  assertEquals(highestModifier("In, Hi", "", "Ag 2, In 5"), 5);
  assertEquals(highestModifier("Ag", "Amber", "In 3, Amber 2"), 2);
  assertEquals(highestModifier("Ag, In", "", "Ag 2, In 5"), 5);
});

Deno.test("population adjusts dice and a non-positive roll stays on the list", () => {
  assertEquals(withPopulation("2D6*10", 2), "(2D6 - 3)*10");
  assertEquals(withPopulation("1D6", 9), "(1D6 + 3)");
  assertEquals(withPopulation("10", 1), "10");
  assertEquals(rollFormula("(2D6 - 3)*10", scripted([1, 1])), -10);

  const listed = listMarket(
    [good({ tons: "2D6*10", availability: "All", purchaseDM: "", saleDM: "" })],
    { ...world, population: 2, port: "X" },
    0,
    -3,
    scripted([1, 1, 6, 6, 6]),
    ids()
  );
  assertEquals(listed.lots.length, 1);
  assertEquals(listed.lots[0]?.tons, 0);
});

Deno.test("available goods are priced once and illegal goods are left out", () => {
  const listed = listMarket(
    [
      good({ tons: "4" }),
      good({ name: "Weapons", illegal: true, availability: "All" }),
      good({ name: "Grain", availability: "Ag" })
    ],
    { ...world, population: 0, port: "X" },
    1,
    4,
    scripted([3, 3, 3]),
    ids()
  );
  assertEquals(listed.lots.map((lot) => lot.name), ["Textiles"]);
  assertEquals(listed.lots[0]?.tons, 4);
  assertEquals(listed.lots[0]?.purchasePerTon, 2400);
  assertEquals(listed.lots[0]?.salePerTon, 1800);
  assertEquals(placeKey(listed.sector, listed.hex), "Spinward Marches|1910");
});

Deno.test("each population digit adds tons of one catalogue good", () => {
  const listed = listMarket(
    [good({ tons: "3", purchaseDM: "", saleDM: "" })],
    { ...world, population: 1, port: "X" },
    0,
    -3,
    scripted([4, 4, 4, 1, 5, 5, 5]),
    ids()
  );
  assertEquals(listed.lots.length, 1);
  assertEquals(listed.lots[0]?.tons, 6);
  assertEquals(listed.lots[0]?.id, "lot-1");
});

Deno.test("a class A starport stocks spare parts from the population", () => {
  const listed = listMarket(
    [],
    { ...world, population: 9, port: "A" },
    0,
    -3,
    scripted([1, 1, 1, 1, 1, 1, 1, 1]),
    ids()
  );
  assertEquals(listed.lots[0]?.name, "Spare Parts");
  assertEquals(listed.lots[0]?.tons, 24);
  assertEquals(listed.lots[0]?.purchasePerTon, 100000);
  assertEquals(listed.lots[0]?.salePerTon, 50000);
});

Deno.test("carried trade goods missing from the list gain a stored sale price", () => {
  const listed = listMarket(
    [good({ tons: "4", purchaseDM: "", saleDM: "" })],
    { ...world, population: 0, port: "X" },
    1,
    -3,
    scripted([3, 3, 3]),
    ids()
  );
  const carried = {
    img: "icons/svg/item-bag.svg",
    price: 3000,
    purchaseDM: "",
    saleDM: "",
    illegal: false,
    salePrice: 0,
    speculative: true
  };
  const next = appendCarriedLots(
    listed,
    [
      { ...carried, name: "Textiles", salePrice: 1 },
      { ...carried, name: "Grain" },
      { ...carried, name: "Relics", price: 0, salePrice: 1200 }
    ],
    [
      good({ tons: "4", purchaseDM: "", saleDM: "" }),
      good({ name: "Grain", availability: "Ag", purchaseDM: "", saleDM: "" })
    ],
    { ...world, population: 0, port: "X" },
    1,
    -3,
    scripted([3, 3, 3]),
    ids()
  );
  assertEquals(next.lots.map((lot) => lot.name), ["Textiles", "Grain", "Relics"]);
  assertEquals(next.lots[0]?.tons, 4);
  assertEquals(next.lots[0]?.salePerTon, 2400);
  assertEquals(next.lots[1]?.tons, 0);
  assertEquals(next.lots[1]?.purchasePerTon, 3000);
  assertEquals(next.lots[1]?.salePerTon, 2400);
  assertEquals(next.lots[2]?.salePerTon, 1200);
});

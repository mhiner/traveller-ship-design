import { assertEquals } from "@std/assert";
import type { Dice } from "./market.ts";
import {
  freightTrafficDice,
  freightTrafficDm,
  freightWorldDm,
  listFreight,
  mailBandDm,
  techFromUwp,
  type FreightWorld
} from "./freight.ts";

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
    return `freight-${next}`;
  };
}

function world(patch: Partial<FreightWorld> = {}): FreightWorld {
  return {
    name: "Regina",
    sector: "Spinward Marches",
    hex: "1910",
    population: 5,
    port: "C",
    tech: 8,
    zone: "",
    ...patch
  };
}

Deno.test("freight modifiers follow the world tab", () => {
  assertEquals(freightWorldDm(world({ population: 0, port: "X", tech: 6, zone: "Red" })), -4 - 3 - 1 - 6);
  assertEquals(freightWorldDm(world({ population: 8, port: "A", tech: 12, zone: "Amber" })), 4 + 2 + 2 - 2);
  assertEquals(freightTrafficDm(world(), world(), 1), 0);
  assertEquals(freightTrafficDm(world(), world(), 3), -2);
});

Deno.test("freight traffic dice match the world tab bands", () => {
  assertEquals(freightTrafficDice(1), 0);
  assertEquals(freightTrafficDice(2), 1);
  assertEquals(freightTrafficDice(8), 3);
  assertEquals(freightTrafficDice(19), 9);
  assertEquals(freightTrafficDice(20), 10);
  assertEquals(mailBandDm(-10), -2);
  assertEquals(mailBandDm(4), 0);
  assertEquals(mailBandDm(10), 2);
  assertEquals(techFromUwp("A788899-C"), 12);
  assertEquals(techFromUwp("???????-?"), null);
});

Deno.test("a route rolls whole lots and one row per mail container", () => {
  const rolled = listFreight(
    world({ sector: "Spinward Marches", hex: "1910", name: "Regina" }),
    world({ sector: "Spinward Marches", hex: "1911", name: "Efate" }),
    1,
    { armed: false, rank: 0, socDm: 0 },
    scripted([1, 1, 3, 3, 1, 1, 1, 2, 2, 2, 1, 1, 1, 4, 6, 6, 2]),
    ids()
  );
  assertEquals(rolled?.parsecs, 1);
  assertEquals(rolled?.trafficDm, 0);
  assertEquals(rolled?.lots.map((lot) => [lot.kind, lot.tons, lot.pricePerTon]), [
    ["minor", 10, 1000],
    ["minor", 10, 1000],
    ["minor", 10, 1000],
    ["incidental", 4, 1000],
    ["mail", 5, 5000],
    ["mail", 5, 5000]
  ]);
  assertEquals(listFreight(world(), world(), 7, { armed: false, rank: 0, socDm: 0 }, scripted([]), ids()), null);
});

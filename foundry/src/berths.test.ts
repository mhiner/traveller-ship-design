import { assertEquals } from "@std/assert";
import {
  addBerths,
  assignBerths,
  berthsOf,
  passageGrade,
  seatsOpen
} from "./berths.ts";

const doubles = berthsOf({ staterooms: 4, doubleStaterooms: 4 });

Deno.test("double staterooms are a capped subset of standard rooms", () => {
  assertEquals(berthsOf({ staterooms: 10, doubleStaterooms: 4, luxuryStaterooms: 1 }), {
    luxury: 1,
    high: 0,
    single: 6,
    double: 4,
    low: 0,
    emergency: 0
  });
  assertEquals(berthsOf({ staterooms: 2, doubleStaterooms: 9 }).double, 2);
});

Deno.test("an empty double room has two free bunks", () => {
  const report = assignBerths(doubles, []);
  assertEquals(report.fits, true);
  assertEquals(report.summary, "Doubles: 4 rooms, 8 bunks free.");
});

Deno.test("a high or middle passenger takes a whole double room", () => {
  const high = assignBerths(berthsOf({
    staterooms: 1,
    doubleStaterooms: 1,
    luxuryStaterooms: 1
  }), ["high"]);
  assertEquals(high.fits, true);
  assertEquals(high.doubleBunksFree, 2);

  const middle = assignBerths(doubles, ["middle"]);
  assertEquals(middle.fits, true);
  assertEquals(middle.doubleBunksFree, 6);
  assertEquals(assignBerths(berthsOf({ staterooms: 1, doubleStaterooms: 1 }), ["middle", "crew"]).fits, false);
});

Deno.test("two basic passengers share a double and crew can take the other bunk", () => {
  const pair = assignBerths(berthsOf({ staterooms: 1, doubleStaterooms: 1 }), ["basic", "basic"]);
  assertEquals(pair.fits, true);
  assertEquals(pair.doubleBunksFree, 0);
  const shared = assignBerths(berthsOf({ staterooms: 1, doubleStaterooms: 1 }), ["basic", "crew"]);
  assertEquals(shared.fits, true);
  assertEquals(shared.doubleBunksFree, 0);
});

Deno.test("low passengers use berths and an emergency berth holds four", () => {
  assertEquals(assignBerths(berthsOf({ lowBerths: 1 }), ["low"]).fits, true);
  assertEquals(assignBerths(berthsOf({ emergencyLowBerths: 1 }), ["low", "low", "low", "low"]).fits, true);
  assertEquals(assignBerths(berthsOf({ emergencyLowBerths: 1 }), ["low", "low", "low", "low", "low"]).fits, false);
});

Deno.test("a missing passage grade counts as middle", () => {
  assertEquals(passageGrade(""), "middle");
  assertEquals(passageGrade("High Passage"), "high");
  const supply = berthsOf({ staterooms: 2, doubleStaterooms: 2 });
  assertEquals(seatsOpen(supply, ["middle"], "basic"), 2);
});

Deno.test("joined hulls add their rooms", () => {
  const joined = addBerths(
    berthsOf({ staterooms: 2, doubleStaterooms: 1 }),
    berthsOf({ staterooms: 4, doubleStaterooms: 4, lowBerths: 2 }),
    2
  );
  assertEquals(joined.double, 9);
  assertEquals(joined.single, 1);
  assertEquals(joined.low, 4);
});

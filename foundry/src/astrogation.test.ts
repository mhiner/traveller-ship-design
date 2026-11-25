import { assertEquals } from "@std/assert";
import { astrogationView, type AstroPlace } from "./astrogation.ts";

const regina: AstroPlace = {
  name: "Regina",
  sector: "Spinward Marches",
  hex: "1910",
  worldX: -110,
  worldY: -70
};

const efate: AstroPlace = {
  name: "Efate",
  sector: "Spinward Marches",
  hex: "1705",
  worldX: -112,
  worldY: -75
};

Deno.test("astrogation offers the selected system until a current system is set", () => {
  const empty = astrogationView({
    current: null,
    target: null,
    selected: regina,
    within: [],
    fuelCost: null,
    fuelHave: 0
  });
  assertEquals(empty.currentLabel, "");
  assertEquals(empty.setLabel, "Set to Regina");
  assertEquals(empty.canSet, true);
  assertEquals(empty.canJump, false);

  const placed = astrogationView({
    current: regina,
    target: null,
    selected: efate,
    within: [{ ...efate, parsecs: 2 }],
    fuelCost: null,
    fuelHave: 40
  });
  assertEquals(placed.currentLabel, "Regina");
  assertEquals(placed.canSet, false);
  assertEquals(placed.options.map((row) => row.label), ["Efate (2)"]);
  assertEquals(placed.canJump, false);
});

Deno.test("astrogation jump is active only for a target inside the jump range with fuel aboard", () => {
  const ready = astrogationView({
    current: regina,
    target: efate,
    selected: null,
    within: [{ ...efate, parsecs: 2 }],
    fuelCost: 20,
    fuelHave: 20
  });
  assertEquals(ready.canJump, true);
  assertEquals(ready.fuelLabel, "20");
  assertEquals(ready.options[0]?.selected, true);
  assertEquals(ready.options[0]?.parsecs, 2);

  const short = astrogationView({
    current: regina,
    target: efate,
    selected: null,
    within: [{ ...efate, parsecs: 2 }],
    fuelCost: 20,
    fuelHave: 19
  });
  assertEquals(short.canJump, false);
  assertEquals(short.fuelLabel, "20");

  const far = astrogationView({
    current: regina,
    target: efate,
    selected: null,
    within: [],
    fuelCost: 20,
    fuelHave: 40
  });
  assertEquals(far.canJump, false);
  assertEquals(far.fuelLabel, "");
});

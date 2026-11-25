import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { blankDesign } from "./design.ts";
import {
  createShipyard,
  type ShipyardHooks,
  type ShipyardJsxRuntime,
} from "./instance.tsx";
import { memoryDesignStorage } from "./storage.ts";

const jsxRuntime: ShipyardJsxRuntime = {
  Fragment: {},
  jsx: () => null,
  jsxs: () => null,
};

const hooks: ShipyardHooks = {
  useState: <T>(initial: T | (() => T)) => {
    const value = typeof initial === "function"
      ? (initial as () => T)()
      : initial;
    return [value, () => {}] as [T, (next: T | ((prev: T) => T)) => void];
  },
  useEffect: () => {},
  useRef: (initial) => ({ current: initial }),
};

describe("shipyard instance", () => {
  it("replaces the default storage and keeps designs there", async () => {
    const yard = createShipyard({ jsxRuntime, hooks });
    const custom = memoryDesignStorage();
    let notices = 0;
    const stopWatching = yard.subscribe(() => {
      notices += 1;
    });
    yard.setStorage(custom);
    assertEquals(yard.storage(), custom);
    assertEquals(notices, 1);
    const design = blankDesign("kept");
    design.name = "Kept";
    await custom.saveDesigns([design]);
    assertEquals((await yard.storage().loadDesigns())[0]?.name, "Kept");
    let builds = 0;
    const stopBuild = yard.on("build", () => {
      builds += 1;
    });
    stopBuild();
    assertEquals(builds, 0);
    stopWatching();
  });
});

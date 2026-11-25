import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { blankDesign, blankModule } from "./design.ts";
import {
  designBundleFromJson,
  designForExport,
  designFromJson,
} from "./store.ts";
import { MIN_HULL_TONS } from "./tables.ts";

describe("advanced design json", () => {
  it("reads one ship design and refuses a list", () => {
    const courier = blankDesign("ship-1");
    courier.name = "Courier";
    courier.description = "Frontier packet";
    courier.classification = "Scout";
    const design = designFromJson(JSON.parse(JSON.stringify(courier)));
    assert(design);
    assertEquals(design.id, "ship-1");
    assertEquals(design.name, "Courier");
    assertEquals(design.description, "Frontier packet");
    assertEquals(design.classification, "Scout");
    const plain = designFromJson({ id: "plain", name: "Plain" });
    assertEquals(plain?.description, "");
    assertEquals(plain?.thrust, 0);
    assertEquals(plain?.jump, 0);
    assertEquals(plain?.power, 0);
    assertEquals(plain?.powerWeeks, 0);
    assertEquals(plain?.techLevel, 0);
    assertEquals(plain?.software, []);
    assertEquals(plain?.scoops, false);
    assertEquals(plain?.commonTons, 0);
    assertEquals(plain?.hullTons, MIN_HULL_TONS);
    assertEquals(designFromJson({ hello: "no" }), null);
    assertEquals(designFromJson([courier]), null);
    assertEquals(designFromJson([]), null);
    const legacy = designFromJson({
      id: "old",
      name: "Old trader",
      hullOptions: [{ id: "join", kind: "breakaway" }],
      breakawayHulls: ["other", "other", ""],
    });
    assertEquals(legacy?.classification, "Other");
    assertEquals(legacy?.hullOptions.map((option) => option.kind), [
      "breakaway",
    ]);
    assertEquals(legacy?.breakawayHulls, ["other", "other"]);
    const moduleDesign = designFromJson({
      id: "mod",
      name: "Cargo pod",
      hullType: "module",
      classification: "Yacht",
    });
    assertEquals(moduleDesign?.hullType, "module");
    assertEquals(moduleDesign?.classification, "Other");
    const modular = designFromJson({
      id: "ship",
      name: "Ship",
      hullOptions: [{
        id: "bay",
        kind: "modular",
        tons: 40.5,
        modules: ["pod", "pod", ""],
      }],
    });
    assertEquals(modular?.hullOptions, [{
      id: "bay",
      kind: "modular",
      tons: 40.5,
      modules: ["pod"],
    }]);
    const bays = designFromJson({
      id: "ship",
      name: "Ship",
      hullOptions: [
        { id: "bay", kind: "modular", tons: 40, modules: [] },
        { kind: "modular", tons: 20 },
        { id: "bay", kind: "breakaway" },
        { id: "again", kind: "breakaway" },
      ],
    });
    assertEquals(bays?.hullOptions, [
      { id: "bay", kind: "modular", tons: 40, modules: [] },
      { id: "modular-1", kind: "modular", tons: 20, modules: [] },
      { id: "breakaway-1", kind: "breakaway" },
    ]);
    const coated = designFromJson({
      id: "ship",
      name: "Ship",
      hullOptions: [{ id: "coat", kind: "solarEnhanced", units: 12.9 }],
    });
    assertEquals(coated?.hullOptions, [{
      id: "coat",
      kind: "solarEnhanced",
      units: 12,
    }]);
  });

  it("embeds docked ships, modules, and breakaway hulls", () => {
    const boat = blankDesign("boat");
    boat.name = "Ship's Boat";
    const pod = blankModule("pod");
    pod.name = "Cargo pod";
    const section = blankDesign("section");
    section.name = "Section";
    section.docks = [{ id: "bay", craft: boat.id }];
    const left = blankDesign("left");
    left.name = "Left";
    const right = blankDesign("right");
    right.name = "Right";
    left.docks = [{ id: "out", craft: right.id }];
    right.docks = [{ id: "back", craft: left.id }];
    const carrier = blankDesign("carrier");
    carrier.name = "Carrier";
    carrier.docks = [{ id: "raft", craft: "air-raft" }, {
      id: "boat",
      craft: boat.id,
    }];
    carrier.hullOptions = [{ id: "join", kind: "breakaway" }, {
      id: "bay",
      kind: "modular",
      tons: 40,
      modules: [pod.id],
    }];
    carrier.breakawayHulls = [section.id, section.id];
    const exported = JSON.parse(
      JSON.stringify(
        designForExport(carrier, [boat, pod, section, left, right]),
      ),
    );
    assertEquals(exported.docks[0].craft, "air-raft");
    assertEquals(exported.docks[1].craft.name, "Ship's Boat");
    assertEquals(exported.hullOptions[1].modules[0].name, "Cargo pod");
    assertEquals(
      exported.breakawayHulls.map((hull: { name: string }) => hull.name),
      ["Section", "Section"],
    );
    assertEquals(exported.breakawayHulls[0].docks[0].craft.name, "Ship's Boat");
    const cycled = JSON.parse(
      JSON.stringify(designForExport(left, [left, right])),
    );
    assertEquals(cycled.docks[0].craft.docks[0].craft, "left");
    const bundle = designBundleFromJson(exported);
    assert(bundle);
    assertEquals(bundle.design.docks.map((dock) => dock.craft), [
      "air-raft",
      "boat",
    ]);
    assertEquals(bundle.design.hullOptions[1].modules, ["pod"]);
    assertEquals(bundle.design.breakawayHulls, ["section", "section"]);
    assertEquals(bundle.bundled.map((row) => row.name).sort(), [
      "Cargo pod",
      "Section",
      "Ship's Boat",
    ]);
    assertEquals(designFromJson(exported)?.breakawayHulls, [
      "section",
      "section",
    ]);
  });

  it("keeps a chosen tonnage for deep penetration scanners", () => {
    const stored = designFromJson({
      name: "Scan",
      additionalSensors: [{ id: "deep", kind: "deep", tons: 25.4 }, {
        id: "net",
        kind: "extension",
      }],
    });
    assertEquals(
      stored?.additionalSensors.map((sensor) => [sensor.kind, sensor.tons]),
      [["deep", 25], ["extension", 0]],
    );
    const missing = designFromJson({
      name: "Scan",
      additionalSensors: [{ kind: "deep" }],
    });
    assertEquals(missing?.additionalSensors[0], {
      id: "deep-1",
      kind: "deep",
      tons: 1,
    });
  });

  it("keeps pop-up mounting only when it is fitted", () => {
    const stored = designFromJson({
      id: "guns",
      name: "Guns",
      hullTons: 200,
      mounts: [
        { id: "turret", kind: "single", weapons: ["pulse"], popup: true },
        { id: "fixed", kind: "fixed", weapons: ["beam"], popup: false },
      ],
    });
    assertEquals(stored?.mounts.map((mount) => mount.popup), [true, undefined]);
    const exported = designForExport(stored!, []) as {
      mounts: { popup?: boolean }[];
    };
    assertEquals(exported.mounts[0]?.popup, true);
    assertEquals("popup" in exported.mounts[1], false);
    assertEquals(designFromJson(exported)?.mounts.map((mount) => mount.popup), [
      true,
      undefined,
    ]);
  });

  it("omits empty and zero values and reads them back as empty or zero", () => {
    const design = blankDesign("sparse");
    design.name = "Sparse";
    design.description = "";
    design.jump = 0;
    design.thrust = 0;
    design.scoops = false;
    design.software = [];
    design.power = 0;
    design.powerWeeks = 0;
    design.techLevel = 0;
    design.fuelTons = 0;
    design.staterooms = 4;
    design.commonTons = 0;
    design.standardDesign = false;
    const exported = designForExport(design, []) as Record<string, unknown>;
    assertEquals(exported.name, "Sparse");
    assertEquals(exported.staterooms, 4);
    assertEquals(exported.hullTons, 200);
    assertEquals("description" in exported, false);
    assertEquals("jump" in exported, false);
    assertEquals("thrust" in exported, false);
    assertEquals("scoops" in exported, false);
    assertEquals("software" in exported, false);
    assertEquals("power" in exported, false);
    assertEquals("powerWeeks" in exported, false);
    assertEquals("techLevel" in exported, false);
    assertEquals("fuelTons" in exported, false);
    assertEquals("commonTons" in exported, false);
    assertEquals("doubleStaterooms" in exported, false);
    assertEquals("standardDesign" in exported, false);
    assertEquals("mounts" in exported, false);
    assertEquals("docks" in exported, false);
    assertEquals("breakawayHulls" in exported, false);
    const imported = designFromJson(exported);
    assertEquals(imported?.name, "Sparse");
    assertEquals(imported?.description, "");
    assertEquals(imported?.thrust, 0);
    assertEquals(imported?.jump, 0);
    assertEquals(imported?.scoops, false);
    assertEquals(imported?.software, []);
    assertEquals(imported?.power, 0);
    assertEquals(imported?.powerWeeks, 0);
    assertEquals(imported?.techLevel, 0);
    assertEquals(imported?.commonTons, 0);
    assertEquals(imported?.staterooms, 4);
    assertEquals(imported?.doubleStaterooms, 0);
    design.doubleStaterooms = 3;
    const withDoubles = designForExport(design, []) as Record<string, unknown>;
    assertEquals(withDoubles.doubleStaterooms, 3);
    assertEquals(designFromJson(withDoubles)?.doubleStaterooms, 3);
    assertEquals(
      designFromJson({ ...withDoubles, doubleStaterooms: 9 })?.doubleStaterooms,
      4,
    );
    assertEquals(imported?.hullTons, 200);
    assertEquals(imported?.mounts, []);
    assertEquals(imported?.docks, []);
  });

  it("creates a design when the id is missing", () => {
    const created = designFromJson({ name: "No id", thrust: 2, hullTons: 100 });
    assert(created);
    assert(created.id.trim().length > 0);
    assertEquals(created.name, "No id");
    assertEquals(created.thrust, 2);
    assertEquals(created.hullTons, 100);
    assertEquals(created.jump, 0);
    assertEquals(created.software, []);
    const again = designFromJson({ name: "No id", thrust: 2, hullTons: 100 });
    assert(again);
    assert(again.id !== created.id);
    const blankId = designFromJson({
      id: "  ",
      name: "Blank id",
      hullTons: 80,
    });
    assert(blankId);
    assert(blankId.id !== "  ");
    assertEquals(blankId.hullTons, 80);

    const bundle = designBundleFromJson({
      name: "Parent",
      hullTons: 200,
      docks: [{ craft: { name: "Boat", hullTons: 30, thrust: 1 } }],
    });
    assert(bundle);
    assert(bundle.design.id.trim().length > 0);
    assertEquals(bundle.bundled.length, 1);
    assertEquals(bundle.bundled[0].name, "Boat");
    assert(bundle.bundled[0].id.trim().length > 0);
    assertEquals(bundle.design.docks[0].craft, bundle.bundled[0].id);
    assertEquals(bundle.bundled[0].thrust, 1);
    assertEquals(bundle.bundled[0].jump, 0);
    assertEquals(bundle.bundled[0].hullTons, 30);
  });

  it("keeps added fuel/cargo containers", () => {
    const design = designFromJson({
      name: "Tender",
      containerTons: 12,
      extraContainers: [
        { id: "spare", tons: 4 },
        { tons: 8 },
        { id: "spare", tons: 1 },
      ],
    });
    assert(design);
    assertEquals(design.containerTons, 12);
    assertEquals(design.extraContainers[0], { id: "spare", tons: 4 });
    assertEquals(design.extraContainers[1].tons, 8);
    assert(design.extraContainers[1].id.length > 0);
    assertEquals(design.extraContainers[2].tons, 1);
    assert(design.extraContainers[2].id !== "spare");
    const again = designFromJson(JSON.parse(JSON.stringify(designForExport(design, []))));
    assertEquals(again?.extraContainers, design.extraContainers);
  });
});

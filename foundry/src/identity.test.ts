import { assertEquals } from "@std/assert";
import { blankDesign } from "../../src/design.ts";
import { forkDesign, isolateDesigns, splitRepeatedBreakaways } from "./identity.ts";

Deno.test("isolateDesigns gives every design a new id and rewrites references", () => {
  const wing = blankDesign("wing");
  wing.hullOptions = [{ id: "bay", kind: "modular", tons: 20, modules: ["pod"] }];
  wing.docks = [
    { id: "boat-bay", craft: "boat" },
    { id: "raft-bay", craft: "air-raft" }
  ];
  const boat = blankDesign("boat");
  const pod = blankDesign("pod");
  const ids = ["wing-2", "boat-2", "pod-2"];
  const copied = isolateDesigns([wing, boat, pod], () => ids.shift() ?? "extra");
  assertEquals(wing.id, "wing");
  assertEquals(copied.map((design) => design.id), ["wing-2", "boat-2", "pod-2"]);
  assertEquals(copied[0].hullOptions?.[0].modules, ["pod-2"]);
  assertEquals(copied[0].docks?.map((dock) => dock.craft), ["boat-2", "air-raft"]);
});

Deno.test("a repeated breakaway hull is forked so each copy has its own id", () => {
  const carrier = blankDesign("carrier");
  carrier.breakawayHulls = ["wing", "wing"];
  const wing = blankDesign("wing");
  wing.name = "Wing";
  wing.docks = [{ id: "boat-bay", craft: "boat" }];
  const boat = blankDesign("boat");
  boat.name = "Boat";
  const ids = ["wing-b", "boat-b"];
  const split = splitRepeatedBreakaways(carrier, [carrier, wing, boat], () => ids.shift() ?? "extra");
  assertEquals(carrier.breakawayHulls, ["wing", "wing-b"]);
  assertEquals(split.added.map((design) => design.id), ["wing-b", "boat-b"]);
  assertEquals(split.added[0].docks?.[0].craft, "boat-b");
  assertEquals(wing.docks?.[0].craft, "boat");
  assertEquals(split.adoptedFrom.get("wing-b"), "wing");
  const again = forkDesign("wing", [wing, boat], () => "unused");
  assertEquals(again?.design.id, "unused");
});

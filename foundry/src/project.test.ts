import { assert, assertEquals } from "@std/assert";
import { blankDesign, blankModule, evaluateDesign } from "../../src/design.ts";
import { designFromHeader, projectShip } from "./project.ts";

Deno.test("projectShip maps hull fields and keeps unknown hull tokens", () => {
  const design = blankDesign("ship-1");
  design.name = "Far Trader";
  design.configuration = "distributed";
  design.hullOptions = [{ id: "heat", kind: "heat" }];
  design.jump = 2;
  const projection = projectShip(design, [design], "military");
  assertEquals(projection.configuration, "dispersed");
  assertEquals(projection.name, "Far Trader");
  assertEquals(projection.type, "Other");
  design.classification = "Free Trader";
  assertEquals(projectShip(design, [design]).type, "Free Trader");
  assert(projection.hullOptions.split(" ").includes("heatShielding"));
  assert(projection.hullOptions.split(" ").includes("military"));
  assert(projection.pieces.some((piece) => piece.key === "j-drive"));
  assertEquals(projection.jdrive, 2);
});

Deno.test("projectShip leaves the name empty when the design is unnamed", () => {
  const design = blankDesign("ship-blank");
  design.name = "  ";
  assertEquals(projectShip(design, [design]).name, "");
});

Deno.test("projectShip stores custom drive advantages on the drive items", () => {
  const design = blankDesign("custom");
  design.jump = 2;
  design.thrust = 2;
  design.driveCustom = {
    thrust: { tier: "very", options: ["energyEfficient", "energyEfficient"] },
    jump: { tier: "early", options: ["lateJump", "increasedSize", "earlyJump"] },
    plant: { tier: "standard", options: ["increasedPower"] }
  };
  const pieces = projectShip(design, [design]).pieces;
  const maneuver = pieces.find((piece) => piece.key === "m-drive");
  assertEquals(maneuver?.advancement, "veryAdvanced");
  assertEquals(maneuver?.advantages, "energyEfficient 2");
  const jump = pieces.find((piece) => piece.key === "j-drive");
  assertEquals(jump?.advancement, "earlyPrototype");
  assertEquals(jump?.advantages, "lateJump 1, increasedSize 1");
  const plant = pieces.find((piece) => piece.key === "power");
  assertEquals(plant?.advancement, "standard");
  assertEquals(plant?.advantages, "");
});

Deno.test("projectShip lists installed software for the computer tab", () => {
  const design = blankDesign("ship-software");
  design.software = ["intellect", "jump2", "jump1", "evade1"];
  const projection = projectShip(design, [design]);
  assertEquals(
    projection.software.map((program) => program.name),
    ["Intellect", "Jump Control/2", "Evade/1"]
  );
  assertEquals(projection.software[0]?.interface, "intellect");
  assertEquals(projection.software[1]?.key, "software:jump2");
  assertEquals(projection.software[1]?.bandwidth, 10);
  assertEquals(projection.software[1]?.cost, 200_000);
});

Deno.test("projectShip records armour type, percent, cost per ton, and cost", () => {
  const design = blankDesign("ship-armour");
  design.hullTons = 200;
  design.configuration = "standard";
  design.armour = "crystaliron";
  design.armourRating = 4;
  const armour = projectShip(design, [design]).pieces.find((piece) =>
    piece.key === "armour"
  );
  assertEquals(armour?.name, "Crystaliron Armour");
  assertEquals(armour?.rating, 4);
  assertEquals(armour?.percent, 1.25);
  assertEquals(armour?.costPerTon, 0.2);
  assertEquals(armour?.tons, 10);
  assertEquals(armour?.cost, 2);
});

Deno.test("projectShip copies each component's design values onto its item", () => {
  const design = blankDesign("ship-parts");
  design.hullTons = 200;
  design.configuration = "standard";
  design.thrust = 1;
  design.powerPlant = "fusion12";
  design.power = 30;
  design.sensors = "military";
  design.computer = "core15";
  design.computerType = "bis";
  const pieces = projectShip(design, [design]).pieces;
  const plant = pieces.find((piece) => piece.key === "power");
  assertEquals(plant?.name, "Fusion (TL12)");
  assertEquals(plant?.tl, 12);
  assertEquals(plant?.rating, 30);
  assertEquals(plant?.powerPerTon, 15);
  assertEquals(plant?.costPerTon, 1);
  assertEquals(plant?.tons, 2);
  assertEquals(plant?.cost, 2);
  const drive = pieces.find((piece) => piece.key === "m-drive");
  assertEquals(drive?.name, "Manoeuvre drive 1");
  assertEquals(drive?.tl, 9);
  assertEquals(drive?.tons, 2);
  assertEquals(drive?.cost, 4);
  assertEquals(drive?.power, 20);
  assertEquals(drive?.costPerTon, 2);
  const sensors = pieces.find((piece) => piece.key === "sensors");
  assertEquals(sensors?.name, "Military sensors");
  assertEquals(sensors?.tl, 10);
  assertEquals(sensors?.tons, 2);
  assertEquals(sensors?.cost, 4.1);
  assertEquals(sensors?.power, 2);
  const computer = pieces.find((piece) => piece.key === "computer");
  assertEquals(computer?.tl, 11);
  assertEquals(computer?.rating, 15);
  assertEquals(computer?.bis, true);
  assertEquals(computer?.cost, 3);
});

Deno.test("projectShip lists a fuel/cargo container apart from the fuel tank", () => {
  const design = blankDesign("ship-container");
  design.hullTons = 200;
  design.jump = 1;
  design.power = 40;
  design.containerTons = 10;
  const projection = projectShip(design, [design]);
  const fuel = projection.pieces.find((piece) => piece.key === "fuel");
  const container = projection.pieces.find((piece) => piece.key === "fuel-cargo");
  assertEquals(container?.name, "Fuel/cargo container (10 t)");
  assertEquals(container?.system, "fuel");
  assertEquals(container?.rating, 10);
  assertEquals(container?.tons, 10.5);
  assertEquals(container?.cost, 0.05);
  assertEquals(fuel?.name, "Fuel tank");
  assertEquals(fuel?.cost, 0);
  assertEquals(projection.fuelMax, fuel?.rating);
  design.extraContainers = [{ id: "second", tons: 6 }];
  const both = projectShip(design, [design]).pieces.filter((piece) =>
    piece.key === "fuel-cargo" || piece.key.startsWith("fuel-cargo:")
  );
  assertEquals(both.map((piece) => piece.key), ["fuel-cargo", "fuel-cargo:second"]);
  assertEquals(both.map((piece) => piece.rating), [10, 6]);
  assertEquals(both[1]?.tons, 6.3);
  assertEquals(both[1]?.cost, 0.03);
});

Deno.test("projectShip lists a fuel processor for ship core", () => {
  const design = blankDesign("ship-processor");
  design.hullTons = 200;
  design.processorTons = 2;
  const piece = projectShip(design, [design]).pieces.find((row) =>
    row.key === "fuel-processor"
  );
  assertEquals(piece?.name, "Fuel processor (40 tons/day)");
  assertEquals(piece?.system, "processor");
  assertEquals(piece?.tons, 2);
  assertEquals(piece?.cost, 0.1);
  assertEquals(piece?.power, 2);
  assertEquals(piece?.rating, 40);
  assertEquals(piece?.costPerTon, 0.05);
  design.processorTons = 0;
  assertEquals(
    projectShip(design, [design]).pieces.some((row) => row.key === "fuel-processor"),
    false
  );
});

Deno.test("projectShip lists common space as living-quarters hardware", () => {
  const design = blankDesign("common");
  design.commonTons = 12;
  const piece = projectShip(design, [design]).pieces.find((row) => row.key === "common");
  assertEquals(piece?.name, "Common space");
  assertEquals(piece?.system, "common");
  assertEquals(piece?.tons, 12);
  assertEquals(piece?.rating, 12);
  assertEquals(piece?.cost, 1.2);
  design.commonTons = 0;
  assertEquals(
    projectShip(design, [design]).pieces.some((row) => row.key === "common"),
    false
  );
});

Deno.test("projectShip lists work spaces as living-quarters hardware", () => {
  const design = blankDesign("spaces");
  design.workSpaces = [
    { id: "med", kind: "medical", quantity: 2 },
    { id: "shop", kind: "workshop", quantity: 1 },
    {
      id: "lab",
      kind: "robotics",
      quantity: 1,
      avatarChair: "standard",
      fabrication: "none",
      droneController: "none",
      swarmController: "none"
    }
  ];
  const pieces = projectShip(design, [design]).pieces;
  const medical = pieces.find((row) => row.key === "workspace:med");
  assertEquals(medical?.name, "Medical Bay x2");
  assertEquals(medical?.system, "common");
  assertEquals(medical?.tons, 8);
  assertEquals(medical?.rating, 8);
  assertEquals(medical?.cost, 4);
  assertEquals(medical?.power, 2);
  const workshop = pieces.find((row) => row.key === "workspace:shop");
  assertEquals(workshop?.name, "Workshop");
  assertEquals(workshop?.tons, 6);
  assertEquals(workshop?.cost, 0.9);
  const robotics = pieces.find((row) => row.key === "workspace:lab");
  assertEquals(robotics?.name, "Robotics Laboratory");
  assertEquals(robotics?.tons, 4);
  assertEquals(robotics?.cost, 0.8);
  design.workSpaces = [];
  assertEquals(
    projectShip(design, [design]).pieces.some((row) => row.key.startsWith("workspace:")),
    false
  );
});

Deno.test("projectShip lists amenities as living-quarters hardware", () => {
  const design = blankDesign("amenities");
  design.amenities = [
    { id: "bio", kind: "biosphere", quantity: 17 },
    { id: "drill", kind: "training", quantity: 4 },
    { id: "bar", kind: "wetBar", quantity: 1 },
    { id: "brew", kind: "brewery", quantity: 2 }
  ];
  const pieces = projectShip(design, [design]).pieces;
  const biosphere = pieces.find((row) => row.key === "amenity:bio");
  assertEquals(biosphere?.name, "Biosphere");
  assertEquals(biosphere?.system, "common");
  assertEquals(biosphere?.tons, 17);
  assertEquals(biosphere?.rating, 17);
  assertEquals(biosphere?.cost, 3.4);
  assertEquals(biosphere?.power, 17);
  const training = pieces.find((row) => row.key === "amenity:drill");
  assertEquals(training?.name, "Training facilities");
  assertEquals(training?.tons, 8);
  assertEquals(training?.cost, 1.6);
  assertEquals(training?.power, 2);
  const bar = pieces.find((row) => row.key === "amenity:bar");
  assertEquals(bar?.name, "Wet bar");
  assertEquals(bar?.tons, 0);
  assertEquals(bar?.rating, 0);
  assertEquals(bar?.cost, 0.002);
  const brewery = pieces.find((row) => row.key === "amenity:brew");
  assertEquals(brewery?.tons, 1);
  assertEquals(brewery?.cost, 0.1);
  assertEquals(brewery?.tl, 10);
  design.amenities = [];
  assertEquals(
    projectShip(design, [design]).pieces.some((row) => row.key.startsWith("amenity:")),
    false
  );
});

Deno.test("projectShip lists aerofins as core hardware", () => {
  const design = blankDesign("fins");
  design.hullTons = 200;
  design.hullOptions = [{ id: "fins", kind: "aerofins" }];
  const piece = projectShip(design, [design]).pieces.find((row) => row.key === "aerofins");
  assertEquals(piece?.name, "Aerofins");
  assertEquals(piece?.system, "aerofins");
  assertEquals(piece?.tons, 10);
  assertEquals(piece?.rating, 10);
  assertEquals(piece?.cost, 1);
  design.hullOptions = [];
  assertEquals(
    projectShip(design, [design]).pieces.some((row) => row.key === "aerofins"),
    false
  );
});

Deno.test("projectShip lists fuel scoops with the hull's cost and no tonnage", () => {
  const design = blankDesign("scoops");
  design.scoops = true;
  const streamlined = projectShip(design, [design]).pieces.find((row) => row.key === "scoops");
  assertEquals(streamlined?.name, "Fuel scoops");
  assertEquals(streamlined?.system, "scoops");
  assertEquals(streamlined?.tons, 0);
  assertEquals(streamlined?.cost, 0);
  design.configuration = "standard";
  const standard = projectShip(design, [design]).pieces.find((row) => row.key === "scoops");
  assertEquals(standard?.tons, 0);
  assertEquals(standard?.cost, 1);
  design.hullType = "light";
  const light = projectShip(design, [design]).pieces.find((row) => row.key === "scoops");
  assertEquals(light?.tons, 0);
  assertEquals(light?.cost, 1);
  design.scoops = false;
  assertEquals(
    projectShip(design, [design]).pieces.some((row) => row.key === "scoops"),
    false
  );
});

Deno.test("projectShip sets holographic controls on the bridge", () => {
  const design = blankDesign("holo-bridge");
  design.holographicControls = true;
  const on = projectShip(design, [design]).pieces.find((row) => row.key === "bridge");
  assertEquals(on?.system, "bridge");
  assertEquals(on?.holographicControls, true);
  design.holographicControls = false;
  const off = projectShip(design, [design]).pieces.find((row) => row.key === "bridge");
  assertEquals(off?.holographicControls, false);
});

Deno.test("projectShip lists remaining fittings and drones as core hardware", () => {
  const design = blankDesign("fittings");
  design.hullTons = 200;
  design.techLevel = 12;
  design.externalSystems = [
    { id: "tube", kind: "breaching", quantity: 1 },
    { id: "link", kind: "linkage", quantity: 1, techLevel: 12 },
    { id: "arm", kind: "grappling", quantity: 2 },
    { id: "small", kind: "clamp1", quantity: 2 },
    { id: "holo", kind: "holographic", quantity: 1 },
    { id: "tow", kind: "tow", quantity: 1 },
    { id: "pod", kind: "reentryPod", quantity: 1 }
  ];
  design.drones = [
    { id: "probe-1", kind: "probe", quantity: 2 },
    { id: "mine-1", kind: "mining", quantity: 1 },
    { id: "repair-1", kind: "repair", quantity: 1 }
  ];
  const pieces = projectShip(design, [design]).pieces;
  const tube = pieces.find((row) => row.key === "fitting:breaching:tube");
  assertEquals(tube?.name, "Breaching tube");
  assertEquals(tube?.system, "fitting");
  assertEquals(tube?.tons, 3);
  assertEquals(tube?.cost, 3);
  const linkage = pieces.find((row) => row.key === "fitting:linkage:link");
  assertEquals(linkage?.name, "Forced linkage apparatus (Enhanced)");
  assertEquals(linkage?.tons, 2);
  assertEquals(linkage?.cost, 0.1);
  assertEquals(linkage?.tl, 12);
  const arm = pieces.find((row) => row.key === "fitting:grappling:arm");
  assertEquals(arm?.tons, 4);
  assertEquals(arm?.cost, 2);
  const clamp = pieces.find((row) => row.key === "fitting:clamp1:small");
  assertEquals(clamp?.name, "Docking clamp (Type I)");
  assertEquals(clamp?.tons, 2);
  assertEquals(clamp?.cost, 1);
  const hull = pieces.find((row) => row.key === "fitting:holographic:holo");
  assertEquals(hull?.tons, 0);
  assertEquals(hull?.cost, 20);
  assertEquals(hull?.power, 100);
  assertEquals(hull?.tl, 10);
  const cable = pieces.find((row) => row.key === "fitting:tow:tow");
  assertEquals(cable?.tons, 2);
  assertEquals(cable?.cost, 0.01);
  const pod = pieces.find((row) => row.key === "fitting:reentryPod:pod");
  assertEquals(pod?.tons, 1);
  assertEquals(pod?.cost, 0.15);
  assertEquals(pod?.tl, 9);
  const probe = pieces.find((row) => row.key === "drone:probe:probe-1");
  assertEquals(probe?.name, "Probe drones ×10");
  assertEquals(probe?.system, "drone");
  assertEquals(probe?.tons, 2);
  assertEquals(probe?.cost, 1);
  assertEquals(probe?.tl, 9);
  const mining = pieces.find((row) => row.key === "drone:mining:mine-1");
  assertEquals(mining?.name, "Mining drones ×5");
  assertEquals(mining?.tons, 10);
  assertEquals(mining?.cost, 1);
  const repair = pieces.find((row) => row.key === "drone:repair:repair-1");
  assertEquals(repair?.name, "Repair drones");
  assertEquals(repair?.tons, 2);
  assertEquals(repair?.cost, 0.4);
  design.externalSystems = [];
  design.drones = [];
  const cleared = projectShip(design, [design]).pieces;
  assertEquals(cleared.some((row) => row.key.startsWith("fitting:")), false);
  assertEquals(cleared.some((row) => row.key.startsWith("drone:")), false);
});

Deno.test("projectShip omits a jump drive when the design cannot jump", () => {
  const design = blankDesign("ship-2");
  design.jump = 0;
  const projection = projectShip(design, [design]);
  assertEquals(projection.jdrive, 0);
  assertEquals(projection.pieces.some((piece) => piece.key === "j-drive"), false);
});

Deno.test("designFromHeader copies the spacecraft header onto the design", () => {
  const design = blankDesign("ship-3");
  design.hullOptions = [{ id: "heat", kind: "heat" }, {
    id: "aerofins",
    kind: "aerofins"
  }];
  const next = designFromHeader(design, {
    name: "Scout",
    dtons: 100,
    tl: 11,
    configuration: "dispersed",
    hullOptions: "reinforced military",
    isStandardDesign: true
  });
  assertEquals(next.name, "Scout");
  assertEquals(next.hullTons, 100);
  assertEquals(next.techLevel, 11);
  assertEquals(next.configuration, "distributed");
  assertEquals(next.hullType, "reinforced");
  assertEquals(next.standardDesign, true);
  assertEquals(next.classification, "Other");
  const yacht = designFromHeader(next, {
    name: next.name,
    dtons: next.hullTons,
    tl: next.techLevel,
    type: "Yacht",
    configuration: next.configuration,
    hullOptions: "reinforced",
    isStandardDesign: true
  });
  assertEquals(yacht.classification, "Yacht");
  const keptClass = designFromHeader(yacht, {
    name: yacht.name,
    dtons: yacht.hullTons,
    tl: yacht.techLevel,
    type: "corvette",
    configuration: yacht.configuration,
    hullOptions: "reinforced",
    isStandardDesign: true
  });
  assertEquals(keptClass.classification, "Yacht");
  assertEquals(next.hullOptions.some((option) => option.kind === "heat"), false);
  assert(next.hullOptions.some((option) => option.kind === "aerofins"));

  const module = blankModule("pod");
  const listed = projectShip(module, [module]).hullOptions.split(" ");
  assert(listed.includes("moduleHull"));
  assertEquals(listed.includes("light"), false);
  assertEquals(listed.includes("reinforced"), false);
  const fromToken = designFromHeader(module, {
    name: module.name,
    dtons: module.hullTons,
    tl: module.techLevel,
    configuration: module.configuration,
    hullOptions: "moduleHull",
    type: "Scout",
    isStandardDesign: false
  });
  assertEquals(fromToken.hullType, "module");
  assertEquals(fromToken.classification, "Other");
  const cleared = designFromHeader(module, {
    name: module.name,
    dtons: module.hullTons,
    tl: module.techLevel,
    configuration: module.configuration,
    hullOptions: "",
    isStandardDesign: false
  });
  assertEquals(cleared.hullType, "standard");
});

Deno.test("adjustable hull joins the hull option list", () => {
  const design = blankDesign("coated");
  design.hullType = "light";
  design.hullOptions = [
    { id: "adj", kind: "adjustable15" },
    { id: "heat", kind: "heat" }
  ];
  const options = projectShip(design, [design], "solarCoating").hullOptions.split(" ");
  assert(options.includes("light"));
  assert(options.includes("adjustableHull15"));
  assert(options.includes("heatShielding"));
  assertEquals(options.includes("solarCoating"), false);

  const kept = designFromHeader(design, {
    name: design.name,
    dtons: design.hullTons,
    tl: design.techLevel,
    configuration: "standard",
    hullOptions: "light adjustableHull15 heatShielding",
    isStandardDesign: false
  });
  assert(kept.hullOptions.some((option) => option.kind === "adjustable15"));
  assert(kept.hullOptions.some((option) => option.kind === "heat"));
});

Deno.test("projectShip lists solar coating as hardware for the tons it covers", () => {
  const design = blankDesign("coated");
  design.hullTons = 200;
  design.configuration = "standard";
  design.techLevel = 12;
  design.hullOptions = [
    { id: "coat", kind: "solarAdvanced", units: 10 },
    { id: "heat", kind: "heat" }
  ];
  const projected = projectShip(design, [design], "solarCoating");
  assertEquals(projected.hullOptions.includes("solarCoating"), false);
  assert(projected.hullOptions.includes("heatShielding"));
  const advanced = projected.pieces.find((row) => row.key === "solar:coat");
  assertEquals(advanced?.name, "Advanced solar coating x10");
  assertEquals(advanced?.system, "solar");
  assertEquals(advanced?.tons, 10);
  assertEquals(advanced?.rating, 10);
  assertEquals(advanced?.cost, 4);
  assertEquals(advanced?.power, 2);
  assertEquals(advanced?.tl, 12);
  assertEquals(projected.powerMax, design.power + 2);
  design.power = 30;
  assertEquals(projectShip(design, [design]).powerMax, 32);

  const kept = designFromHeader(design, {
    name: design.name,
    dtons: design.hullTons,
    tl: design.techLevel,
    configuration: "standard",
    hullOptions: projected.hullOptions,
    isStandardDesign: false
  });
  assertEquals(
    kept.hullOptions.find((option) => option.kind === "solarAdvanced")?.units,
    10
  );

  design.techLevel = 10;
  design.configuration = "close";
  design.hullOptions = [{ id: "coat", kind: "solarEnhanced", units: 80 }];
  const enhanced = projectShip(design, [design]).pieces.find((row) =>
    row.key === "solar:coat"
  );
  assertEquals(enhanced?.name, "Enhanced solar coating x80");
  assertEquals(enhanced?.tons, 80);
  assertEquals(enhanced?.cost, 24);
  assertEquals(enhanced?.power, 4);
  assertEquals(enhanced?.tl, 10);
  design.configuration = "streamlined";
  const streamlined = projectShip(design, [design]);
  assertEquals(
    streamlined.pieces.find((row) => row.key === "solar:coat")?.power,
    0
  );
  assertEquals(streamlined.powerMax, 30);

  design.hullOptions = [];
  assertEquals(
    projectShip(design, [design]).pieces.some((row) => row.key.startsWith("solar:")),
    false
  );
});

Deno.test("projectShip lists a grav screen as core hardware", () => {
  const design = blankDesign("screen");
  design.hullTons = 200;
  design.techLevel = 12;
  design.hullOptions = [{ id: "screen", kind: "grav" }];
  const plain = projectShip(blankDesign("plain"), [blankDesign("plain")]);
  const projected = projectShip(design, [design]);
  const piece = projected.pieces.find((row) => row.key === "grav:screen");
  assertEquals(piece?.name, "Grav Screen");
  assertEquals(piece?.system, "grav");
  assertEquals(piece?.tons, 1);
  assertEquals(piece?.rating, 1);
  assertEquals(piece?.cost, 1);
  assertEquals(piece?.power, 2);
  assertEquals(projected.powerUsed, plain.powerUsed + 2);

  design.hullTons = 400;
  const larger = projectShip(design, [design]).pieces.find((row) => row.key === "grav:screen");
  assertEquals(larger?.tons, 2);
  assertEquals(larger?.cost, 2);
  assertEquals(larger?.power, 4);

  design.hullTons = 150;
  const small = projectShip(design, [design]).pieces.find((row) => row.key === "grav:screen");
  assertEquals(small?.tons, 0.75);
  assertEquals(small?.cost, 0.75);
  assertEquals(small?.power, 1.5);

  design.hullOptions = [];
  assertEquals(
    projectShip(design, [design]).pieces.some((row) => row.key.startsWith("grav:")),
    false
  );
});

Deno.test("projectShip lists a pressure hull as core hardware", () => {
  const design = blankDesign("deep");
  design.hullTons = 200;
  design.configuration = "streamlined";
  design.hullOptions = [{ id: "deep", kind: "pressure" }];
  const projected = projectShip(design, [design]);
  const piece = projected.pieces.find((row) => row.key === "pressure:deep");
  assertEquals(piece?.name, "Pressure Hull");
  assertEquals(piece?.system, "pressure");
  assertEquals(piece?.tons, 50);
  assertEquals(piece?.rating, 50);
  assertEquals(piece?.cost, 120);
  assertEquals(projected.armour, 4);

  design.hullType = "light";
  assertEquals(
    projectShip(design, [design]).pieces.find((row) => row.key === "pressure:deep")?.cost,
    90
  );
  design.hullType = "standard";
  design.configuration = "planetoid";
  assertEquals(
    projectShip(design, [design]).pieces.find((row) => row.key === "pressure:deep")?.cost,
    8
  );

  design.hullOptions = [];
  assertEquals(
    projectShip(design, [design]).pieces.some((row) => row.key.startsWith("pressure:")),
    false
  );
});

Deno.test("projectShip lists modular hull tonnage as core hardware", () => {
  const design = blankDesign("cutter");
  design.hullTons = 200;
  design.hullOptions = [
    { id: "forward", kind: "modular", tons: 80 },
    { id: "aft", kind: "modular", tons: 70 }
  ];
  const pieces = projectShip(design, [design]).pieces;
  const forward = pieces.find((row) => row.key === "modular:forward");
  const aft = pieces.find((row) => row.key === "modular:aft");
  assertEquals(forward?.name, "Modular Hull");
  assertEquals(forward?.system, "modular");
  assertEquals(forward?.tons, 80);
  assertEquals(forward?.rating, 80);
  assertEquals(aft?.tons, 70);
  assertEquals((forward?.cost ?? 0) > 0, true);
  assertEquals((aft?.cost ?? 0) > 0, true);

  design.hullOptions = [{ id: "bay", kind: "modular", tons: 160 }];
  const capped = projectShip(design, [design]).pieces.find((row) =>
    row.key === "modular:bay"
  );
  assertEquals(capped?.tons, 150);
  assertEquals(capped?.cost, 9);

  design.hullOptions = [];
  assertEquals(
    projectShip(design, [design]).pieces.some((row) => row.key.startsWith("modular:")),
    false
  );
});

Deno.test("projectShip fills weapon combat values from the weapon type", () => {
  const design = blankDesign("guns");
  design.hullTons = 200;
  design.mounts = [
    {
      id: "turret",
      kind: "double",
      weapons: ["beam", "drill"],
      custom: [
        { tier: "very", options: ["longRange"] },
        { tier: "budget", options: ["inaccurate"] }
      ]
    },
    {
      id: "bar",
      kind: "barbette",
      weapons: ["particleBarbette"],
      custom: [{ tier: "very", options: ["intenseFocus"] }]
    }
  ];
  const pieces = projectShip(design, [design]).pieces;
  const beam = pieces.find((piece) => piece.name === "Beam laser");
  assertEquals(beam?.damage, "1d6");
  assertEquals(beam?.spaceRange, "long");
  assertEquals(beam?.characteristic, "DEX");
  assertEquals(beam?.skill, "gunner.turret");
  assertEquals(beam?.attackBonus, 0);
  assertEquals(beam?.damageType, "laser");
  assertEquals(beam?.power, 4);
  assertEquals(beam?.traits, "");
  const drill = pieces.find((piece) => piece.name === "Laser drill");
  assertEquals(drill?.damage, "4d6");
  assertEquals(drill?.spaceRange, "adjacent");
  assertEquals(drill?.attackBonus, -4);
  assertEquals(drill?.damageBonus, "");
  const particle = pieces.find((piece) => piece.name === "Particle Barbette");
  assertEquals(particle?.damage, "4d6");
  assertEquals(particle?.spaceRange, "verylong");
  assertEquals(particle?.traits, "radiation, ap 2");
  assertEquals(particle?.mount, "barbette");
  assertEquals(beam?.mount, "turret");
  assertEquals(pieces.find((piece) => piece.key === "mount:turret")?.mount, "turret");
  assertEquals(pieces.find((piece) => piece.key === "mount:bar")?.mount, "barbette");
  assertEquals(particle?.damageType, "energy");

  design.hullTons = 50;
  design.mounts = [{
    id: "small",
    kind: "fixed",
    weapons: ["pulse", "missile"]
  }];
  const small = projectShip(design, [design]).pieces;
  const pulse = small.find((piece) => piece.name === "Pulse laser");
  assertEquals(pulse?.mount, "fixed");
  assertEquals(small.find((piece) => piece.key === "mount:small")?.mount, "fixed");
  assertEquals(pulse?.spaceRange, "close");
  assertEquals(pulse?.power, 3);
  const missile = small.find((piece) => piece.name === "Missile rack");
  assertEquals(missile?.spaceRange, "distant");
  assertEquals(missile?.magazine, 4);
  assertEquals(missile?.traits, "smart");
});

Deno.test("projectShip lists external cargo spaces only when that gear is fitted", () => {
  const design = blankDesign("ship-cargo");
  design.hullTons = 200;
  assertEquals(
    projectShip(design, [design]).pieces.some((row) => String(row.key).startsWith("cargo:")),
    false
  );
  design.cargoGear = [
    { id: "mount", kind: "external", quantity: 40 },
    { id: "star", kind: "jumpNet", quantity: 100 },
    { id: "local", kind: "planetaryNet", quantity: 25 },
    { id: "crane", kind: "crane", quantity: 1 }
  ];
  const pieces = projectShip(design, [design]).pieces;
  const mount = pieces.find((row) => row.key === "cargo:external:mount");
  assertEquals(mount?.name, "External cargo mount");
  assertEquals(mount?.system, "cargo");
  assertEquals(mount?.rating, 40);
  assertEquals(mount?.tons, 40);
  const jump = pieces.find((row) => row.key === "cargo:jumpNet:star");
  assertEquals(jump?.name, "Interstellar jump net");
  assertEquals(jump?.rating, 100);
  assertEquals(jump?.tl, 10);
  const local = pieces.find((row) => row.key === "cargo:planetaryNet:local");
  assertEquals(local?.name, "Interplanetary jump net");
  assertEquals(local?.rating, 25);
  assertEquals(local?.tl, 8);
  assertEquals(pieces.filter((row) => row.key === "cargo").length, 1);
});

Deno.test("projectShip lists cargo handling gear in the cargo section", () => {
  const design = blankDesign("handling");
  design.techLevel = 12;
  design.cargoGear = [
    { id: "crane", kind: "crane", quantity: 1 },
    { id: "net", kind: "cargoNet", quantity: 1 },
    { id: "scoop", kind: "cargoScoop", quantity: 1 },
    { id: "belt", kind: "belt", quantity: 2 },
    { id: "fast", kind: "belt12", quantity: 1 }
  ];
  const sheet = evaluateDesign(design);
  const pieces = projectShip(design, [design]).pieces;
  const craneLine = sheet.lines.find((line) => line.name === "Cargo crane");
  const crane = pieces.find((row) => row.key === "handling:crane:crane");
  assertEquals(crane?.name, "Cargo crane");
  assertEquals(crane?.system, "cargo");
  assertEquals(crane?.rating, 0);
  assertEquals(crane?.tons, craneLine?.tons);
  assertEquals(crane?.cost, craneLine?.cost);
  const net = pieces.find((row) => row.key === "handling:cargoNet:net");
  assertEquals(net?.name, "Cargo net");
  assertEquals(net?.tons, 5);
  assertEquals(net?.cost, 1);
  assertEquals(net?.rating, 0);
  const scoop = pieces.find((row) => row.key === "handling:cargoScoop:scoop");
  assertEquals(scoop?.tons, 2);
  assertEquals(scoop?.cost, 0.5);
  const belt = pieces.find((row) => row.key === "handling:belt:belt");
  assertEquals(belt?.name, "Loading belt ×2");
  assertEquals(belt?.tons, 1);
  assertEquals(belt?.cost, 0.006);
  assertEquals(belt?.power, 2);
  assertEquals(belt?.tl, 7);
  const fast = pieces.find((row) => row.key === "handling:belt12:fast");
  assertEquals(fast?.name, "Loading belt (TL12)");
  assertEquals(fast?.cost, 0.01);
  assertEquals(fast?.power, 1);
  assertEquals(fast?.tl, 12);
  const hold = pieces.find((row) => row.key === "cargo");
  assertEquals(hold?.rating, sheet.cargo);
  design.cargoGear = [];
  assertEquals(
    projectShip(design, [design]).pieces.some((row) => row.key.startsWith("handling:")),
    false
  );
});

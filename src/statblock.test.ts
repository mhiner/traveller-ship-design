import { assert, assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { exportStatBlocks } from "./combined.ts";
import { blankDesign, evaluateDesign } from "./design.ts";
import { shipStatHtml, shipStatsHtml, statHtmlFilename } from "./statblock.ts";
import { STANDARD_DESIGNS } from "./templates.ts";

describe("ship stat html", () => {
  it("writes the far trader as one High Guard stat block", () => {
    const trader = STANDARD_DESIGNS.find((row) => row.name === "Far Trader");
    assert(trader);
    const html = shipStatHtml(trader, evaluateDesign(trader));
    assert(html.startsWith("<!DOCTYPE html>"));
    assert(html.includes("<style>"));
    assert(!html.includes("<link"));
    assert(!/<script/i.test(html));
    assert(html.includes("<h1>Far Trader</h1>"));
    assert(html.includes("Free Trader"));
    assert(html.includes("TL12"));
    assert(html.includes("200 tons, Streamlined"));
    assert(html.includes("Crystaliron, Armour: 2"));
    assert(html.includes("Thrust 1"));
    assert(html.includes("Jump 2"));
    assert(html.includes("Fusion (TL12), Power 75"));
    assert(html.includes("J-2, 4 weeks of operation"));
    assert(html.includes("Computer/5bis"));
    assert(html.includes("Civilian Grade"));
    assert(html.includes("Fuel processor (40 tons/day)"));
    assert(html.includes("Standard x10"));
    assert(html.includes(">Cargo<"));
    assert(html.includes(">65<"));
    assert(html.includes(">58.045<"));
    assert(html.includes("MCr52.2405"));
    assert(html.includes("Cr4,353/month"));
    assert(html.includes("Basic Ship Systems"));
    assert(html.includes("Jump Drive"));
    assert(html.includes("Hull <strong>80</strong>"));
    assert(html.includes("Pilot, Astrogator, Engineer, Medic, Steward"));
    assertEquals(statHtmlFilename(trader.name), "far-trader.html");
  });

  it("names double occupancy beside the standard staterooms", () => {
    const design = blankDesign("bunks");
    design.name = "Bunks";
    design.staterooms = 10;
    design.doubleStaterooms = 4;
    const html = shipStatHtml(design, evaluateDesign(design));
    assert(html.includes("Standard x10 (4 double occupancy)"));
  });

  it("lists the deep penetration scan rate beside the scanners", () => {
    const design = blankDesign("scan");
    design.name = "Surveyor";
    design.techLevel = 13;
    design.additionalSensors = [{ id: "deep", kind: "deep", tons: 250 }];
    const html = shipStatHtml(design, evaluateDesign(design));
    assert(html.includes("Deep Penetration Scanners (scan 5,000 tons/hr)"));
    assert(html.includes(">250<"));
  });

  it("lists a pop-up mount with its weapon", () => {
    const design = blankDesign("popup");
    design.hullTons = 200;
    design.mounts = [
      { id: "turret", kind: "single", weapons: ["pulse"], popup: true },
      { id: "fixed", kind: "fixed", weapons: ["beam"], popup: true },
    ];
    const html = shipStatHtml(design, evaluateDesign(design));
    assert(html.includes("Single turret (pop-up, Pulse laser)"));
    assert(html.includes("Fixed mount (pop-up, Beam laser)"));
  });

  it("names a custom-tonnage jump drive by the designated rating", () => {
    const design = blankDesign("rated");
    design.jump = 2;
    design.driveCustom = {
      thrust: { tier: "standard", options: [] },
      jump: { tier: "standard", options: [], effectiveTons: 250 },
      plant: { tier: "standard", options: [] },
    };
    const html = shipStatHtml(design, evaluateDesign(design));
    assert(html.includes("Jump 2 (250 tons)"));
    assert(html.includes("Thrust 1"));
    assert(!html.includes("Thrust 1 ("));
  });

  it("escapes the ship name and keeps the file self-contained", () => {
    const design = blankDesign("unsafe");
    design.name = `</title><script>alert("x")</script>`;
    const html = shipStatHtml(design, evaluateDesign(design));
    assert(!html.includes("<script>"));
    assert(
      html.includes(
        "&lt;/title&gt;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
      ),
    );
    assertEquals(
      statHtmlFilename(design.name),
      "title-script-alert-x-script.html",
    );
    assertEquals(statHtmlFilename("   "), "ship.html");
  });

  it("lists combined stats, the primary hull, then each distinct breakaway hull", () => {
    const pod = blankDesign("pod");
    pod.name = "Pod";
    const section = blankDesign("section");
    section.name = "Section";
    section.hullOptions = [{ id: "join", kind: "breakaway" }];
    section.breakawayHulls = ["pod", "pod"];
    const wing = blankDesign("wing");
    wing.name = "Wing";
    const carrier = blankDesign("carrier");
    carrier.name = "Carrier";
    carrier.hullOptions = [{ id: "join", kind: "breakaway" }];
    carrier.breakawayHulls = ["section", "section", "missing", "wing"];
    const html = shipStatsHtml(
      carrier.name,
      exportStatBlocks(carrier, [section, wing, pod]),
    );
    const titles = [...html.matchAll(/<h1>([^<]*)<\/h1>/g)].map((match) =>
      match[1]
    );
    assertEquals(titles, ["Carrier Combined", "Carrier", "Section", "Wing"]);
    assert(html.includes("Breakaway Hull (Section x2, Wing)"));
    assert(html.includes("Breakaway Hull (Pod x2)"));
    assert(html.startsWith("<!DOCTYPE html>"));
    assertEquals(html.match(/<style>/g)?.length, 1);
  });
});

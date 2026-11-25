import { render } from "preact";
import { Fragment, jsx, jsxs } from "preact/jsx-runtime";
import { useEffect, useRef, useState } from "preact/hooks";
import { blankDesign, type AdvancedDesign } from "../../src/design.ts";
import { freshId } from "../../src/ui/design/shared.tsx";
import { installShipyardRuntime } from "../../src/runtime.ts";
import { ShipEditor, type ShipEditorApi } from "./editor.tsx";

export { designFromHeader, projectShip, solarSupply } from "./project.ts";
export type { ShipHeader, ShipProjection } from "./project.ts";
export { dockShipResult, occupyShipBays, projectBays, projectCarriedBays, clampedTonnage } from "./bays.ts";
export type { DesignBay, HeldShip } from "./bays.ts";
export { applyModules, assignModuleBays, moduleActorSlots, moduleBays, moduleCapacity, moduleSpace } from "./modules.ts";
export { astrogationView } from "./astrogation.ts";
export { addBerths, assignBerths, berthsOf, passageGrade, seatsOpen } from "./berths.ts";
export type { BerthDesign, BerthReport, BerthSupply, Passage } from "./berths.ts";
export { appendCarriedLots, listMarket, placeKey } from "./market.ts";
export { listFreight, techFromUwp } from "./freight.ts";
export type { FreightLot, FreightRoll, FreightWorld } from "./freight.ts";
export type { CarriedGood, CatalogueGood, MarketList, MarketLot, MarketWorld } from "./market.ts";
export { applyBreakaways, breakawayActorSlots, breakawayJumpFuel, combinedJump, combinedManoeuvre,
  designsReferencedBy, isBreakawayDesign, loadedBreakawayDrives } from "./breakaway.ts";
export { forkDesign, isolateDesigns, splitRepeatedBreakaways } from "./identity.ts";
export type { JoinedHull } from "./breakaway.ts";
export { cargoSpaceKind, effectiveDrives, externalLoad, jumpDisplacement, jumpFuelUse } from "./cargo.ts";

/** Designs saved on the actor, plus the actor name used when a design has none. */
export interface BlueprintRecord {
  currentId: string;
  designs: AdvancedDesign[];
  modules: AdvancedDesign[];
  actorName: string;
}

/** How the editor reads and writes the actor. */
export interface BlueprintBridge {
  /** Reads the designs saved on the actor. */
  load(): Promise<BlueprintRecord>;
  /** Writes the open design back. immediate asks the host to store this change at once. */
  sync(
    design: AdvancedDesign,
    modules: readonly AdvancedDesign[],
    immediate: boolean
  ): void;
}

/**
 * Chooses the design the editor opens.
 * The current id wins, then the first saved design. A ship with no saved design starts blank.
 * A blank design name takes the actor name. alignName is set when the design name and the actor name differ.
 */
function openDesign(record: BlueprintRecord): {
  design: AdvancedDesign;
  modules: AdvancedDesign[];
  alignName: boolean;
} {
  const designs = record.designs ?? [];
  const found = designs.find((design) => design.id === record.currentId) ??
    designs[0];
  const modules = structuredClone(record.modules ?? []) as AdvancedDesign[];
  if (found) {
    // The editor mutates its draft, so the loaded record is cloned first.
    const design = structuredClone(found) as AdvancedDesign;
    const actorName = record.actorName.trim();
    const designName = design.name.trim();
    design.name = designName || actorName;
    return {
      design,
      modules,
      alignName: design.name !== "" && design.name !== actorName
    };
  }
  const design = blankDesign(freshId());
  const actorName = record.actorName.trim();
  if (actorName) design.name = actorName;
  return { design, modules: [], alignName: false };
}

/** Mount the single ship editor and keep the actor pointed at that design. */
export async function mountBlueprint(
  root: HTMLElement,
  bridge: BlueprintBridge
): Promise<{
  destroy(): void;
  replace(design: AdvancedDesign, modules: AdvancedDesign[]): void;
  draft(): { design: AdvancedDesign; modules: AdvancedDesign[] } | null;
}> {
  // Wires Preact into the shared design sections before the editor renders.
  installShipyardRuntime(
    { Fragment, jsx, jsxs },
    { useEffect, useRef, useState }
  );
  const loaded = await bridge.load();
  const opened = openDesign(loaded);
  let api: ShipEditorApi | null = null;
  render(
    <ShipEditor
      design={opened.design}
      modules={opened.modules}
      onChange={(design, modules) => bridge.sync(design, modules, false)}
      onReady={(next) => {
        api = next;
      }}
    />,
    root
  );
  // The opened design is written through at once so the actor matches the form.
  bridge.sync(opened.design, opened.modules, true);
  return {
    /** Unmounts the editor from the sheet. */
    destroy() {
      render(null, root);
    },
    /** Replaces the open design with one the host already holds. */
    replace(design, modules) {
      api?.replace(design, modules);
    },
    /** The design currently open, or null before the editor reports ready. */
    draft() {
      return api?.draft() ?? null;
    }
  };
}

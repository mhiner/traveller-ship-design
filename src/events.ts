import type { AdvancedDesign } from "./design.ts";
import type { DesignShipStats } from "./toShipDesign.ts";

/** A finished design the host can turn into its own ship. */
export interface ShipyardBuild {
  name: string;
  design: AdvancedDesign;
  catalog: readonly AdvancedDesign[];
  stats: DesignShipStats;
}

export interface ShipyardListeners {
  /** The builder asked to add this design to the host. */
  build?: (event: ShipyardBuild) => void;
  /** The open design changed, or was cleared. */
  designName?: (name: string | null) => void;
  /** The open draft changed after its first render. */
  draft?: (design: AdvancedDesign) => void;
  /** The host asked for a design name that is not in the catalog. */
  designMissing?: () => void;
  /** Saved designs or modules were written to storage. */
  stored?: () => void;
}

export type ShipyardEvent = keyof ShipyardListeners;

export interface ShipyardEmit {
  (event: "build", payload: ShipyardBuild): void;
  (event: "designName", name: string | null): void;
  (event: "draft", design: AdvancedDesign): void;
  (event: "designMissing"): void;
  (event: "stored"): void;
}

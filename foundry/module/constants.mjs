/** Foundry package id. Flags, the actor type, and template paths are keyed by this. */
export const MODULE_ID = "traveller-blueprint";

/** Stored actor type. Foundry keeps module subtypes as moduleId.subtype. */
export const SHIP_TYPE = `${MODULE_ID}.ship`;

/** Portrait and token for a new blueprint ship. A chosen image is left as it is. */
export const SHIP_ICON = "systems/mgt2e/images/tokens/spacecraft/white/free_trader.webp";

/**
 * Update option that marks a write as internal.
 * largely here to prevent annoying jumps on auto save
 */
export const SYNC_OPTION = "travelerBlueprintSync";

/** Sheet paths Foundry serves for an installed module, from the user Data directory. */
export const SHEET_TEMPLATE = `modules/${MODULE_ID}/templates/ship-sheet.html`;

/** Partials the ship sheet loads. Paths are from the Foundry Data directory. */
export const SHEET_PARTS = [
  "actor-starship-combat.html",
  "actor-starship-hardware.html",
  "actor-starship-crew.html",
  "actor-starship-bays.html"
].map((name) => `modules/${MODULE_ID}/templates/parts/${name}`);

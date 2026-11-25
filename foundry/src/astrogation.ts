/** A world stored on the ship or reported by the Astrogation map. */
export interface AstroPlace {
  name: string;
  sector: string;
  hex: string;
  worldX: number | null;
  worldY: number | null;
}

/** A destination within jump range, with the distance in parsecs. */
export interface AstroOption extends AstroPlace {
  parsecs: number;
}

/** One target row: its label, whether it is selected, and the place it jumps to. */
export interface AstrogationChoice {
  id: string;
  label: string;
  selected: boolean;
  parsecs: number;
  place: AstroPlace;
}

/** Text and enabled flags for the astrogation bar. */
export interface AstrogationView {
  currentLabel: string;
  setLabel: string;
  canSet: boolean;
  options: AstrogationChoice[];
  /** Fuel this jump spends, when a target in range is chosen. */
  fuelLabel: string;
  canJump: boolean;
}

/** Sector and hex identify a system. Names can repeat. */
export function placeId(place: Pick<AstroPlace, "sector" | "hex">): string {
  return `${place.sector}|${place.hex}`;
}

/** The name shown for a system. An unnamed world uses its sector and hex. */
export function placeLabel(place: Pick<AstroPlace, "name" | "sector" | "hex">): string {
  const name = place.name.trim();
  if (name) return name;
  return [place.sector.trim(), place.hex.trim()].filter(Boolean).join(" ");
}

/**
 * Left-bar astrogation controls.
 * The set button appears only while the ship has no current system.
 * Jump is active only when the target is in range and the ship has the fuel that jump spends.
 */
export function astrogationView(input: {
  current: AstroPlace | null;
  target: AstroPlace | null;
  selected: AstroPlace | null;
  within: readonly AstroOption[];
  fuelCost: number | null;
  fuelHave: number;
}): AstrogationView {
  const currentLabel = input.current ? placeLabel(input.current) : "";
  const selectedLabel = input.selected ? placeLabel(input.selected) : "";
  const targetId = input.target ? placeId(input.target) : "";
  const counts = new Map<string, number>();
  for (const row of input.within) {
    const name = placeLabel(row);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const options = input.within.map((row) => {
    const name = placeLabel(row);
    // A repeated world name keeps its hex so the two systems stay distinct.
    const extra = (counts.get(name) ?? 0) > 1 && row.hex.trim() ? ` ${row.hex.trim()}` : "";
    return {
      id: placeId(row),
      label: `${name}${extra} (${row.parsecs})`,
      selected: placeId(row) === targetId,
      parsecs: row.parsecs,
      place: {
        name: row.name,
        sector: row.sector,
        hex: row.hex,
        worldX: row.worldX,
        worldY: row.worldY
      }
    };
  });
  const cost = Number(input.fuelCost);
  const have = Number(input.fuelHave);
  const priced = Number.isFinite(cost) && cost > 0;
  // A thousandth of a ton of rounding still counts as enough fuel.
  const affordable = priced && Number.isFinite(have) && have + 1e-9 >= cost;
  return {
    currentLabel,
    setLabel: selectedLabel ? `Set to ${selectedLabel}` : "",
    canSet: currentLabel.length === 0 && selectedLabel.length > 0,
    options,
    fuelLabel: priced && options.some((row) => row.selected) ? fuelText(cost) : "",
    canJump: currentLabel.length > 0 && options.some((row) => row.selected) && affordable
  };
}

/** Fuel tons for the label, trimmed to hundredths. */
function fuelText(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

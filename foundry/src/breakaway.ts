import { JUMP_HULL_PERCENT, jumpPerformance } from "../../src/catalog/drives.ts";
import {
  componentValue,
  pilotSkill,
  round3,
  sensorRank,
  type ShipPiece,
  type ShipProjection
} from "./project.ts";

/** Shared systems kept as one item on the parent. The rest of each hull is copied across. */
const CHOSEN = new Set([
  "computer",
  "j-drive",
  "m-drive",
  "power",
  "fuel",
  "armour",
  "sensors",
  "bridge"
]);

/** One breakaway hull and how many copies are joined. */
export interface JoinedHull {
  id: string;
  name: string;
  quantity: number;
  projection: ShipProjection;
}

/** A ship can carry other breakaway hulls only when it is one itself. */
export function isBreakawayDesign(
  design: { hullType?: string; hullOptions?: { kind?: string }[] } | null | undefined
): boolean {
  if (!design || design.hullType === "module") return false;
  return (design.hullOptions ?? []).some((option) => option?.kind === "breakaway");
}

/** The piece with this key, when the projection still has it. */
function findPiece(
  projection: ShipProjection,
  key: string
): ShipPiece | undefined {
  return projection.pieces.find((piece) => piece.key === key);
}

/** Puts a piece under a fixed key, replacing the previous item when one is present. */
function replacePiece(projection: ShipProjection, key: string, piece: ShipPiece) {
  const next = structuredClone(piece);
  next.key = key;
  const index = projection.pieces.findIndex((row) => row.key === key);
  if (index >= 0) projection.pieces[index] = next;
  else projection.pieces.push(next);
}

/** Adds the source's numeric fields onto the target, to three decimals. */
function addFields(target: ShipPiece, source: ShipPiece, fields: readonly (keyof ShipPiece)[]) {
  for (const field of fields) {
    const value = source[field];
    if (typeof value !== "number") continue;
    const current = target[field];
    (target[field] as number) = round3((typeof current === "number" ? current : 0) + value);
  }
}

/** Copies a piece under a hull prefix and rewrites its attachment keys. */
function relocate(piece: ShipPiece, prefix: string, name?: string): ShipPiece {
  const next = structuredClone(piece);
  next.key = `${prefix}${piece.key}`;
  if (name) next.name = name;
  if (next.attaches) next.attaches = next.attaches.map((key) => `${prefix}${key}`);
  return next;
}

/** The main hold or an external hold, including a hold already prefixed to a hull. */
function isCargoHold(piece: ShipPiece): boolean {
  return piece.key === "cargo" || piece.key.startsWith("cargo:") ||
    piece.key.endsWith(":cargo") || piece.key.includes(":cargo:");
}

interface SharedChoice {
  key: string;
  take: boolean;
  own?: ShipPiece;
  theirs?: ShipPiece;
  apply?: () => void;
}

/** Drive potential used to choose the larger jump drive. A higher numeral on a smaller basis can be the smaller drive. */
function jumpPotential(basis: number, rating: number): number {
  const percent = JUMP_HULL_PERCENT[Math.trunc(rating)];
  if (percent == null || !(basis > 0)) return 0;
  return percent * basis;
}

/** Which shared system the joined hull replaces. A strict improvement wins, and a tie keeps the parent. */
function sharedChoices(ship: ShipProjection, joined: ShipProjection): SharedChoice[] {
  const ownJump = findPiece(ship, "j-drive");
  const ownComputer = findPiece(ship, "computer");
  const ownSensors = findPiece(ship, "sensors");
  const ownBridge = findPiece(ship, "bridge");
  const theirJump = findPiece(joined, "j-drive");
  const theirComputer = findPiece(joined, "computer");
  const theirSensors = findPiece(joined, "sensors");
  const theirBridge = findPiece(joined, "bridge");
  return [
    {
      key: "computer",
      take: (joined.processing ?? 0) > (ship.processing ?? 0),
      own: ownComputer,
      theirs: theirComputer,
      apply: () => {
        ship.processing = joined.processing;
        ship.computerBis = joined.computerBis;
        ship.computerFib = joined.computerFib;
      }
    },
    {
      key: "j-drive",
      // Potential is the built rating's table percent times the tonnage that drive was sized for.
      take: jumpPotential(joined.jumpBasis ?? 0, joined.jumpRating ?? 0) >
        jumpPotential(ship.jumpBasis ?? 0, ship.jumpRating ?? 0),
      own: ownJump,
      theirs: theirJump,
      apply: () => {
        // The kept drive's design basis and jump fuel travel with the rating.
        ship.jumpRating = joined.jumpRating ?? 0;
        ship.jumpBasis = joined.jumpBasis ?? 0;
        ship.jumpFuel = joined.jumpFuel ?? 0;
        ship.jumpFuelHull = joined.jumpFuelHull ?? joined.dtons;
      }
    },
    {
      key: "sensors",
      take: sensorRank(theirSensors?.name) > sensorRank(ownSensors?.name),
      own: ownSensors,
      theirs: theirSensors
    },
    {
      key: "bridge",
      take: (theirBridge?.tons ?? 0) > (ownBridge?.tons ?? 0),
      own: ownBridge,
      theirs: theirBridge
    }
  ];
}

/** Power of the shared system that was discarded. The parent wins a tie. */
function chooseShared(ship: ShipProjection, joined: ShipProjection): number {
  let discarded = 0;
  for (const choice of sharedChoices(ship, joined)) {
    discarded += choice.take ? (choice.own?.power ?? 0) : (choice.theirs?.power ?? 0);
    if (!choice.take || !choice.theirs) continue;
    replacePiece(ship, choice.key, choice.theirs);
    choice.apply?.();
  }
  return discarded;
}

/** Adds a joined piece's fields onto the parent's item, or copies the piece when the parent has none. */
function sumPiece(
  ship: ShipProjection,
  joined: ShipProjection,
  key: string,
  fields: readonly (keyof ShipPiece)[]
) {
  const own = findPiece(ship, key);
  const theirs = findPiece(joined, key);
  if (!theirs) return;
  if (own) addFields(own, theirs, fields);
  else ship.pieces.push(structuredClone(theirs));
}

/** Adds armour tons and cost. The rating becomes the lower of the two hulls. */
function sumArmour(ship: ShipProjection, joined: ShipProjection) {
  const own = findPiece(ship, "armour");
  const theirs = findPiece(joined, "armour");
  if (theirs && own) {
    addFields(own, theirs, ["tons", "cost"]);
    own.rating = Math.min(own.rating ?? 0, theirs.rating ?? 0);
    return;
  }
  if (theirs) ship.pieces.push(structuredClone(theirs));
}

/** Adds hull, hits, cost, and supplies. Discarded shared-system power is removed from power used, and armour becomes the lower rating. */
function addJoinedTotals(ship: ShipProjection, joined: ShipProjection, discardedPower: number) {
  ship.dtons = round3(ship.dtons + joined.dtons);
  ship.hitsMax = round3(ship.hitsMax + joined.hitsMax);
  ship.cost = round3(ship.cost + joined.cost);
  ship.powerUsed = round3(Math.max(0, ship.powerUsed + joined.powerUsed - discardedPower));
  ship.skill = pilotSkill(ship.dtons);
  ship.thrustPotential = round3(
    (ship.thrustPotential ?? 0) + (joined.thrustPotential ?? 0)
  );
  ship.powerMax = round3(ship.powerMax + joined.powerMax);
  ship.fuelMax = round3(ship.fuelMax + joined.fuelMax);
  ship.armour = Math.min(ship.armour, joined.armour);
  ship.enclosedTons = round3((ship.enclosedTons ?? 0) + (joined.enclosedTons ?? 0));
}

/** Copies fittings the shared-system pass left in place. Each cargo hold keeps the hull's name. */
function copyRemainder(ship: ShipProjection, hull: JoinedHull, copy: number) {
  const prefix = `breakaway:${hull.id}:${copy}:`;
  const label = hull.name.trim() || "Breakaway hull";
  for (const piece of hull.projection.pieces) {
    if (!componentValue(piece, { keepScoops: true }) || CHOSEN.has(piece.key)) continue;
    if (isCargoHold(piece)) {
      const hold = piece.key === "cargo" ? `${label} cargo` : `${label} ${piece.name}`;
      ship.pieces.push(relocate(piece, prefix, hold));
      if (piece.key === "cargo" || piece.key.endsWith(":cargo")) {
        // The main hold's rating is added to the combined cargo total.
        ship.cargo = round3(ship.cargo + (piece.rating ?? 0));
      }
      continue;
    }
    ship.pieces.push(relocate(piece, prefix));
  }
}

/** Copies programs, keeping the first program of each key. */
function mergeSoftware(ship: ShipProjection, joined: ShipProjection) {
  const seen = new Set(ship.software.map((program) => program.key));
  for (const program of joined.software) {
    if (seen.has(program.key)) continue;
    seen.add(program.key);
    ship.software.push(structuredClone(program));
  }
}

/** One joined hull. Shared systems keep a single item. Cargo stays its own hold. */
function mergeHull(ship: ShipProjection, hull: JoinedHull, copy: number) {
  const joined = hull.projection;
  const discarded = chooseShared(ship, joined);
  addJoinedTotals(ship, joined, discarded);
  sumPiece(ship, joined, "m-drive", ["tons", "cost", "power"]);
  sumPiece(ship, joined, "power", ["rating", "tons", "cost", "power"]);
  sumPiece(ship, joined, "fuel", ["rating", "tons", "cost", "power"]);
  sumArmour(ship, joined);
  copyRemainder(ship, hull, copy);
  mergeSoftware(ship, joined);
}

/**
 * Manoeuvre of hulls joined together.
 * Each drive contributes its rating times the tonnage it was designed against.
 * That sum is divided by the combined tonnage and rounded down.
 */
export function combinedManoeuvre(potential: number, hullTons: number): number {
  if (!(hullTons > 0) || !(potential > 0)) return 0;
  return Math.min(11, Math.floor(potential / hullTons + 1e-9));
}

/** Jump the kept drive can deliver on `hullTons`. */
export function combinedJump(
  hullTons: number,
  jumpBasis: number,
  jumpRating: number
): number {
  return jumpPerformance(hullTons, jumpBasis, jumpRating);
}

/**
 * Fuel for one jump at `jump` on `hullTons`, scaled from the drive that was kept.
 * The stored fuel is for jumpRating on jumpFuelHull.
 */
export function breakawayJumpFuel(
  ship: Pick<ShipProjection, "jumpRating" | "jumpFuel" | "jumpFuelHull">,
  jump: number,
  hullTons: number
): number {
  const rated = Number(ship.jumpRating) || 0;
  const want = Number(jump) || 0;
  const fuel = Number(ship.jumpFuel) || 0;
  const basis = Number(ship.jumpFuelHull) || 0;
  const shown = Number(hullTons) || 0;
  if (rated <= 0 || want <= 0 || fuel <= 0 || basis <= 0 || shown <= 0) return 0;
  return Math.round(fuel * (want / rated) * (shown / basis) * 100) / 100;
}

/** Jump and manoeuvre after extra cargo or a clamped ship is added to a joined hull. */
export function loadedBreakawayDrives(
  ship: Pick<
    ShipProjection,
    "dtons" | "thrustPotential" | "jumpBasis" | "jumpRating"
  >,
  load: { external?: number; jumpNet?: number; planetary?: number; clamped?: number }
): { mdrive: number; jdrive: number } {
  const carried = (load.external ?? 0) + (load.jumpNet ?? 0) + (load.clamped ?? 0);
  const mass = (ship.dtons ?? 0) + carried;
  const planetary = load.planetary ?? 0;
  return {
    mdrive: combinedManoeuvre(ship.thrustPotential ?? 0, mass + planetary),
    // Cargo in an interplanetary net counts for manoeuvre and sets jump to zero.
    jdrive: planetary > 0 ? 0 : combinedJump(mass, ship.jumpBasis ?? 0, ship.jumpRating ?? 0)
  };
}

/** Writes the combined manoeuvre and jump back onto the drive items. */
function rateCombinedDrives(ship: ShipProjection) {
  ship.mdrive = combinedManoeuvre(ship.thrustPotential ?? 0, ship.dtons);
  ship.jdrive = combinedJump(ship.dtons, ship.jumpBasis ?? 0, ship.jumpRating ?? 0);
  const drive = findPiece(ship, "m-drive");
  if (drive) drive.rating = ship.mdrive;
  const jump = findPiece(ship, "j-drive");
  if (jump) jump.rating = ship.jdrive;
}

/**
 * Fold joined breakaway hulls into one ship.
 * The higher computer and the largest jump drive are kept.
 * Manoeuvre is each drive's rating times its design tonnage, divided by the combined tonnage.
 * The kept jump drive is re-rated for that same tonnage. Cargo from each hull stays a separate hold.
 * An empty list leaves the stock hull unchanged.
 */
export function applyBreakaways(
  ship: ShipProjection,
  joined: readonly JoinedHull[]
): ShipProjection {
  const next = structuredClone(ship);
  let joinedAny = false;
  for (const hull of joined) {
    const quantity = Math.max(0, Math.round(hull.quantity));
    for (let copy = 0; copy < quantity; copy += 1) {
      mergeHull(next, hull, copy);
      joinedAny = true;
    }
  }
  // Drive ratings are recomputed once, after every hull has been added.
  if (joinedAny) rateCombinedDrives(next);
  return next;
}

/** Breakaway designs named on this ship, in list order. Repeated ids stay repeated. */
export function breakawayActorSlots<T extends {
  id: string;
  hullType?: string;
  hullOptions?: { kind?: string }[];
  breakawayHulls?: string[];
}>(
  design: T | null | undefined,
  catalog: readonly T[]
): T[] {
  if (!isBreakawayDesign(design)) return [];
  const slots: T[] = [];
  for (const id of design?.breakawayHulls ?? []) {
    const hull = catalog.find((row) => row.id === id);
    if (!hull || hull.id === design?.id || !isBreakawayDesign(hull)) continue;
    slots.push(hull);
  }
  return slots;
}

/** Designs a hull points at, not including the hull itself. */
export function designsReferencedBy<T extends {
  id: string;
  breakawayHulls?: string[];
  hullOptions?: { kind?: string; modules?: string[] }[];
  docks?: { craft?: string }[];
}>(
  design: T,
  catalog: readonly T[]
): T[] {
  const wanted = new Set<string>();
  const seen = new Set<string>([design.id]);
  /** Follows a referenced design. A repeated id ends this branch so mutual references stay finite. */
  const visit = (id: string | undefined) => {
    if (!id || seen.has(id)) return;
    const found = catalog.find((row) => row.id === id);
    if (!found) return;
    seen.add(id);
    wanted.add(id);
    for (const hullId of found.breakawayHulls ?? []) visit(hullId);
    for (const option of found.hullOptions ?? []) {
      for (const moduleId of option.modules ?? []) visit(moduleId);
    }
    for (const dock of found.docks ?? []) visit(dock.craft);
  };
  for (const hullId of design.breakawayHulls ?? []) visit(hullId);
  for (const option of design.hullOptions ?? []) {
    for (const moduleId of option.modules ?? []) visit(moduleId);
  }
  for (const dock of design.docks ?? []) visit(dock.craft);
  return catalog.filter((row) => wanted.has(row.id));
}

/** A design id and the fields that point at other designs. */
interface DesignNode {
  id: string;
  breakawayHulls?: string[];
  hullOptions?: { modules?: string[] }[];
  docks?: { craft?: string }[];
}

/** New id for a copied design. Tests pass their own sequence. */
function uuid(): string {
  return crypto.randomUUID();
}

/** Designs reachable from a root, including the root. An id that is not in the catalog is skipped. */
export function collectDesigns<T extends DesignNode>(
  rootId: string,
  catalog: readonly T[]
): T[] {
  const byId = new Map(catalog.filter((design) => design?.id).map((design) => [design.id, design]));
  const seen = new Set<string>();
  const collected: T[] = [];
  /** Follows one design id. A repeated id stops so a loop stays finite. */
  const visit = (id: string | undefined) => {
    if (!id || seen.has(id)) return;
    const found = byId.get(id);
    if (!found) return;
    seen.add(id);
    collected.push(found);
    for (const hullId of found.breakawayHulls ?? []) visit(hullId);
    for (const option of found.hullOptions ?? []) {
      for (const moduleId of option.modules ?? []) visit(moduleId);
    }
    for (const dock of found.docks ?? []) visit(dock.craft);
  };
  visit(rootId);
  return collected;
}

/** Rewrites design ids that were copied. An id that is not in the map, such as a vehicle, stays. */
function rewriteDesign<T extends DesignNode>(design: T, ids: Map<string, string>): T {
  const next = structuredClone(design);
  if (next.id && ids.has(next.id)) next.id = ids.get(next.id) ?? next.id;
  if (next.breakawayHulls) {
    next.breakawayHulls = next.breakawayHulls.map((id) => ids.get(id) ?? id);
  }
  if (next.hullOptions) {
    next.hullOptions = next.hullOptions.map((option) => ({
      ...option,
      modules: option.modules?.map((id) => ids.get(id) ?? id)
    }));
  }
  if (next.docks) {
    next.docks = next.docks.map((dock) => ({
      ...dock,
      craft: dock.craft && ids.has(dock.craft) ? ids.get(dock.craft) ?? dock.craft : dock.craft
    }));
  }
  return next;
}

/**
 * Copies designs onto new ids.
 * References between the copies are rewritten. The originals are left unchanged.
 */
export function isolateDesigns<T extends DesignNode>(
  designs: readonly T[],
  newId: () => string = uuid
): T[] {
  const ids = new Map<string, string>();
  for (const design of designs) {
    if (!design?.id || ids.has(design.id)) continue;
    ids.set(design.id, newId());
  }
  return designs.map((design) => rewriteDesign(design, ids));
}

/** One design and the designs it points at, each with a new id. The catalog is not changed. */
export function forkDesign<T extends DesignNode>(
  rootId: string,
  catalog: readonly T[],
  newId: () => string = uuid
): { design: T; modules: T[] } | null {
  const collected = collectDesigns(rootId, catalog);
  if (collected.length === 0) return null;
  const isolated = isolateDesigns(collected, newId);
  return { design: isolated[0], modules: isolated.slice(1) };
}

/**
 * Gives each repeated breakaway hull its own design id.
 * The first copy keeps its id. Later copies are forked. `adoptedFrom` maps a new id back to the id it was copied from.
 */
export function splitRepeatedBreakaways<T extends DesignNode>(
  design: T | null | undefined,
  catalog: readonly T[],
  newId: () => string = uuid
): { added: T[]; adoptedFrom: Map<string, string> } {
  const added: T[] = [];
  const adoptedFrom = new Map<string, string>();
  if (!design?.breakawayHulls?.length) return { added, adoptedFrom };
  const seen = new Set<string>();
  const hulls: string[] = [];
  const pool = [...catalog];
  let changed = false;
  for (const id of design.breakawayHulls) {
    if (!id || !seen.has(id)) {
      if (id) seen.add(id);
      hulls.push(id);
      continue;
    }
    const forked = forkDesign(id, pool, newId);
    if (!forked) {
      hulls.push(id);
      continue;
    }
    changed = true;
    hulls.push(forked.design.id);
    adoptedFrom.set(forked.design.id, id);
    added.push(forked.design, ...forked.modules);
    pool.push(forked.design, ...forked.modules);
  }
  if (changed) design.breakawayHulls = hulls;
  return { added, adoptedFrom };
}

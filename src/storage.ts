import { openDB } from "idb";
import type { AdvancedDesign } from "./design.ts";
import { designsFromStored } from "./store.ts";

/** Persistence for saved ships and modules. Replace this on a shipyard instance to keep designs somewhere else. */
export interface DesignStorage {
  loadDesigns(): Promise<AdvancedDesign[]>;
  saveDesigns(designs: readonly AdvancedDesign[]): Promise<void>;
  loadModules(): Promise<AdvancedDesign[]>;
  saveModules(modules: readonly AdvancedDesign[]): Promise<void>;
}

const DATABASE = "traveler-advanced-designs";

/** IndexedDB store used when a shipyard is created without a custom storage. */
export function indexedDbDesignStorage(databaseName = DATABASE): DesignStorage {
  const database = () =>
    openDB(databaseName, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("designs")) {
          db.createObjectStore("designs");
        }
      },
    });
  return {
    async loadDesigns() {
      const db = await database();
      return designsFromStored(await db.get("designs", "list"));
    },
    async saveDesigns(designs) {
      const db = await database();
      await db.put("designs", [...designs], "list");
    },
    async loadModules() {
      const db = await database();
      return designsFromStored(await db.get("designs", "modules"));
    },
    async saveModules(modules) {
      const db = await database();
      await db.put("designs", [...modules], "modules");
    },
  };
}

/** In-memory store for tests and hosts that keep designs themselves. */
export function memoryDesignStorage(
  seed?: {
    designs?: readonly AdvancedDesign[];
    modules?: readonly AdvancedDesign[];
  },
): DesignStorage {
  let designs = [...(seed?.designs ?? [])];
  let modules = [...(seed?.modules ?? [])];
  return {
    loadDesigns() {
      return Promise.resolve(designs.map((design) => structuredClone(design)));
    },
    saveDesigns(next) {
      designs = next.map((design) => structuredClone(design));
      return Promise.resolve();
    },
    loadModules() {
      return Promise.resolve(modules.map((design) => structuredClone(design)));
    },
    saveModules(next) {
      modules = next.map((design) => structuredClone(design));
      return Promise.resolve();
    },
  };
}

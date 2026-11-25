import type { AdvancedDesign } from "./design.ts";
import type {
  ShipyardBuild,
  ShipyardEmit,
  ShipyardEvent,
  ShipyardListeners,
} from "./events.ts";
import {
  installShipyardRuntime,
  type ShipyardHooks,
  type ShipyardJsxRuntime,
  useEffect,
  useState,
} from "./runtime.ts";

export type { ShipyardHooks, ShipyardJsxRuntime };
import { type DesignStorage, indexedDbDesignStorage } from "./storage.ts";
import { ShipyardView } from "./ui/Shipyard.tsx";

export interface ShipyardViewProps {
  hidden?: boolean;
  requestedDesign?: { name: string; token: number } | null;
}

export interface ShipyardInstance {
  /** Swap the store used by this shipyard. The open catalog reloads from it. */
  setStorage(storage: DesignStorage): void;
  storage(): DesignStorage;
  /** Listen for a host interaction. The returned function removes that listener. */
  on<K extends ShipyardEvent>(
    event: K,
    listener: NonNullable<ShipyardListeners[K]>,
  ): () => void;
  /** Fires when storage is replaced or a save finishes. */
  subscribe(listener: () => void): () => void;
  // deno-lint-ignore no-explicit-any
  View: (props: ShipyardViewProps) => any;
}

export interface ShipyardOptions {
  jsxRuntime: ShipyardJsxRuntime;
  hooks: ShipyardHooks;
  storage?: DesignStorage;
}

export function createShipyard(options: ShipyardOptions): ShipyardInstance {
  installShipyardRuntime(options.jsxRuntime, options.hooks);
  const box = {
    storage: options.storage ?? indexedDbDesignStorage(),
    generation: 0,
  };
  const buildListeners = new Set<(event: ShipyardBuild) => void>();
  const nameListeners = new Set<(name: string | null) => void>();
  const draftListeners = new Set<(design: AdvancedDesign) => void>();
  const missingListeners = new Set<() => void>();
  const storedListeners = new Set<() => void>();
  const storageWatchers = new Set<() => void>();
  const saveWatchers = new Set<() => void>();

  const emit: ShipyardEmit = (event, payload?) => {
    if (event === "build") {
      for (const listener of buildListeners) listener(payload as ShipyardBuild);
      return;
    }
    if (event === "designName") {
      for (const listener of nameListeners) listener(payload as string | null);
      return;
    }
    if (event === "draft") {
      for (const listener of draftListeners) listener(payload as AdvancedDesign);
      return;
    }
    if (event === "designMissing") {
      for (const listener of missingListeners) listener();
      return;
    }
    for (const listener of storedListeners) listener();
    for (const watcher of saveWatchers) watcher();
  };

  function subscribe(listener: () => void) {
    saveWatchers.add(listener);
    storageWatchers.add(listener);
    return () => {
      saveWatchers.delete(listener);
      storageWatchers.delete(listener);
    };
  }

  function View(props: ShipyardViewProps) {
    const [generation, setGeneration] = useState(box.generation);
    useEffect(() => {
      const listener = () => setGeneration(box.generation);
      storageWatchers.add(listener);
      return () => {
        storageWatchers.delete(listener);
      };
    }, []);
    return (
      <ShipyardView
        key={generation}
        storage={box.storage}
        emit={emit}
        hidden={props.hidden}
        requestedDesign={props.requestedDesign}
      />
    );
  }

  return {
    setStorage(storage) {
      box.storage = storage;
      box.generation += 1;
      for (const watcher of storageWatchers) watcher();
    },
    storage() {
      return box.storage;
    },
    on(event, listener) {
      if (event === "build") {
        const build = listener as (payload: ShipyardBuild) => void;
        buildListeners.add(build);
        return () => buildListeners.delete(build);
      }
      if (event === "designName") {
        const named = listener as (name: string | null) => void;
        nameListeners.add(named);
        return () => nameListeners.delete(named);
      }
      if (event === "draft") {
        const drafted = listener as (design: AdvancedDesign) => void;
        draftListeners.add(drafted);
        return () => draftListeners.delete(drafted);
      }
      if (event === "designMissing") {
        const missing = listener as () => void;
        missingListeners.add(missing);
        return () => missingListeners.delete(missing);
      }
      const stored = listener as () => void;
      storedListeners.add(stored);
      return () => storedListeners.delete(stored);
    },
    subscribe,
    View,
  };
}

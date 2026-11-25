export interface ShipyardJsxRuntime {
  // The host's vnode type stays unnamed so this package does not depend on Preact.
  // deno-lint-ignore no-explicit-any
  jsx: (type: any, props: any, key?: any) => any;
  // deno-lint-ignore no-explicit-any
  jsxs: (type: any, props: any, key?: any) => any;
  // deno-lint-ignore no-explicit-any
  Fragment: any;
}

export interface ShipyardHooks {
  useState: <T>(
    initial: T | (() => T),
  ) => [T, (value: T | ((prev: T) => T)) => void];
  useEffect: (
    effect: () => void | (() => void),
    deps?: readonly unknown[],
  ) => void;
  useRef: <T>(initial: T) => { current: T };
}

interface Installed {
  jsxRuntime: ShipyardJsxRuntime;
  hooks: ShipyardHooks;
}

let installed: Installed | null = null;

export const fragment = Symbol("shipyard.fragment");

export function installShipyardRuntime(
  jsxRuntime: ShipyardJsxRuntime,
  hooks: ShipyardHooks,
): void {
  installed = { jsxRuntime, hooks };
}

function runtime(): Installed {
  if (!installed) {
    throw new Error(
      "Call createShipyard() with the host Preact runtime before rendering.",
    );
  }
  return installed;
}

function hostType(type: unknown): unknown {
  return type === fragment ? runtime().jsxRuntime.Fragment : type;
}

// deno-lint-ignore no-explicit-any
export function jsx(type: any, props: any, key?: any): any {
  const jsxRuntime = runtime().jsxRuntime;
  return jsxRuntime.jsx(hostType(type), props, key);
}

// deno-lint-ignore no-explicit-any
export function jsxs(type: any, props: any, key?: any): any {
  const jsxRuntime = runtime().jsxRuntime;
  return jsxRuntime.jsxs(hostType(type), props, key);
}

export function useState<T>(
  initial: T | (() => T),
): [T, (value: T | ((prev: T) => T)) => void] {
  return runtime().hooks.useState(initial);
}

export function useEffect(
  effect: () => void | (() => void),
  deps?: readonly unknown[],
): void {
  runtime().hooks.useEffect(effect, deps);
}

export function useRef<T>(initial: T): { current: T } {
  return runtime().hooks.useRef(initial);
}

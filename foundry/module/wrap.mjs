import { SHIP_TYPE } from "./constants.mjs";

/** One disguise frame per actor, so nested calls restore the real type only once. */
const frames = new WeakMap();

/**
 * Present a blueprint ship as a spacecraft for the duration of one call.
 * Nested calls keep the disguise until the outermost call finishes.
 * The actor's own type property is put back afterwards. Deleting it leaves
 * Foundry's data field missing, and the Mongoose sheet then asks for
 * actor-undefined-sheet.html.
 */
export function withSpacecraftType(actor, run) {
  if (!actor) return run();
  let frame = frames.get(actor);
  // A real spacecraft, or any other actor, is left alone.
  if (actor.type !== SHIP_TYPE && !frame) return run();
  if (!frame) {
    frame = {
      level: 0,
      descriptor: Object.getOwnPropertyDescriptor(actor, "type")
    };
    frames.set(actor, frame);
    Object.defineProperty(actor, "type", {
      configurable: true,
      enumerable: true,
      get: () => "spacecraft",
      set: () => {}
    });
  }
  frame.level += 1;
  // Restore only when the outermost call returns, including after a promise.
  const restore = () => {
    frame.level -= 1;
    if (frame.level > 0) return;
    frames.delete(actor);
    if (frame.descriptor) Object.defineProperty(actor, "type", frame.descriptor);
    else delete actor.type;
  };
  try {
    const result = run();
    if (result && typeof result.then === "function") return result.finally(restore);
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}

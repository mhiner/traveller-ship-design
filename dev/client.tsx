import { render } from "preact";
import { Fragment, jsx, jsxs } from "preact/jsx-runtime";
import { useEffect, useRef, useState } from "preact/hooks";
import { createShipyard } from "../mod.ts";

const yard = createShipyard({
  jsxRuntime: { Fragment, jsx, jsxs },
  hooks: { useEffect, useRef, useState },
});
const status = document.querySelector("#dev-status");

function note(text: string) {
  if (status) status.textContent = text;
}

yard.on("build", (event) => {
  note(`Built ${event.name}. This dev host does not keep a fleet.`);
});
yard.on("designName", (name) => {
  document.title = name ? `${name} · Shipyard` : "Shipyard";
});
yard.on("designMissing", () => {
  note("That design is not in this shipyard.");
});

const root = document.querySelector("#shipyard");
if (!root) throw new Error("Missing #shipyard");
const View = yard.View;
render(<View />, root);

# @traveler/ship-design

Ship design for Mongoose Traveller 2e. The library evaluates a hull, drives, fittings, weapons, and cost, and it can mount a shipyard editor in a host page.Originally part of a larger project to simulate trade, the shipyard was extracted as a stand-alone project.

The host supplies the JSX runtime. This package does not depend on Preact.

```ts
import { render } from "preact";
import { Fragment, jsx, jsxs } from "preact/jsx-runtime";
import { useEffect, useRef, useState } from "preact/hooks";
import { createShipyard } from "@traveler/ship-design";

const yard = createShipyard({
  jsxRuntime: { Fragment, jsx, jsxs },
  hooks: { useEffect, useRef, useState },
});

yard.on("build", (event) => {
  console.log(event.name, event.stats);
});

const View = yard.View;
render(<View />, document.querySelector("#shipyard"));
```

Include the shipyard stylesheet from `@traveler/ship-design/styles.css`.

Saved designs and modules go to IndexedDB. Pass `storage` to keep them somewhere else. `memoryDesignStorage` holds them in memory. `setStorage` swaps the store on a live shipyard, and `subscribe` runs after a save or a storage change.

`on` listens for host events:

| Event | When it fires |
| --- | --- |
| `build` | The builder asks the host to add the open design. The payload is the design, its catalog, and `DesignShipStats`. |
| `designName` | The open design name changes, or the design is cleared. |
| `draft` | The open draft changes after its first render. |
| `designMissing` | The host asked for a design name that is not in the catalog. |
| `stored` | Designs or modules were written to storage. |

## Evaluating a design

`blankDesign` and `blankModule` start an empty ship or module. `evaluateDesign` returns the sheet: tonnage, cost, power, fuel, cargo, and the design lines. `STANDARD_DESIGNS` is the built-in catalog. `shipDesignFromAdvanced` reduces a design to the hull figures in `DesignShipStats`.

```ts
import { blankDesign, evaluateDesign } from "@traveler/ship-design";

const design = blankDesign("scout");
design.name = "Scout";
design.hullTons = 100;
design.jump = 2;
design.thrust = 2;

const sheet = evaluateDesign(design);
```

`designFromJson`, `designForExport`, and `designBundleFromJson` read and write the design document. `SHIP_CLASSIFICATIONS` lists the ship classifications the sheet can record.

## Repository

The source repository also contains a browser dev server and a Foundry VTT module. `dev/` and `foundry/` are excluded from this package. In the repository, `deno task dev` serves the shipyard, `deno task foundry` builds the module, and `deno test -A` runs the tests.

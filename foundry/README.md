# Koko's Traveller Ship Design

A Foundry VTT module, `traveller-blueprint`, for Mongoose Traveller 2e. A Blueprint Ship actor edits its design in the shipyard, and the sheet keeps the spacecraft hull, drives, and hardware in step with that design.

It adapts the design interface and places it in the "blueprint" tab in the ship.  The blueprint ship Actor is more complete than the current stock ship in that it implements armour types, modules, breakaway hulls, and external cargo.  It wraps the default mongoose spacecraft but does not currently support combat.

This integration is **far** more complex than the original shipyard and has a number fo complicated interactions with Foundry.  This should be considered an experimental release.  I will attempt to make it backwards compatible as I update and fix features by cannot gaurantee it as of this time.

The solution also ports the trade functionality from the World Actor to the ship and uses world information from Koko's Traveller Astrogation, to include Freight and Mail but not Passengers (yet).

This directory is part of the source repository and is not published in `@traveler/ship-design`.

Foundry VTT 13 or 14 is required. Version 14 is verified. The Mongoose Traveller 2e system (`mgt2e`) 0.25.0 is required.

## Build

From the repository root:

```sh
deno task foundry
```

That writes `foundry/dist/preact.js`, `foundry/dist/blueprint.js`, and `foundry/styles/blueprint.css`.

```sh
deno task foundry-release
```

That builds the module and writes two release files:

- `foundry/release/module.zip` is the add-on. Install it from Foundry’s setup screen. The archive root is the `traveller-blueprint` folder.
- `foundry/release/module.json` is the manifest for the package listing.

`foundry/release/` is gitignored. The `zip` command must be on `PATH`.

## Use

Create an actor of type Blueprint Ship. A new actor uses the white free-trader token until you choose another image.

Reload the world after a change to a script, template, or stylesheet. Restart Foundry after a change to `module.json`.

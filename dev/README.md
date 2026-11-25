# Shipyard dev server

A standalone page for the shipyard. It is part of this repository and is not published in `@traveler/ship-design`.

From the repository root:

```sh
deno task dev
```

Open http://127.0.0.1:8787. Set `PORT` to serve on another port. Designs and modules are saved in this browser. The page reloads when the client bundle changes. Ctrl-C stops the server and the bundler.

The page creates a shipyard with Preact and renders `yard.View` into `#shipyard`. `build` updates the status line. This host does not keep a fleet.

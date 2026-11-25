const port = Number(Deno.env.get("PORT") ?? 8787);
const devDir = new URL("./", import.meta.url);
const bundlePath = new URL("./.bundle/app.js", devDir);
const listeners = new Set<(stamp: string) => void>();

await Deno.mkdir(new URL("./.bundle/", devDir), { recursive: true });
try {
  await Deno.remove(bundlePath);
} catch (error) {
  if (!(error instanceof Deno.errors.NotFound)) throw error;
}

// The bundle compiles shipyard JSX through the local forwarder. This
// client then supplies its own Preact when it creates the shipyard.
const bundler = new Deno.Command(Deno.execPath(), {
  args: [
    "bundle",
    "--watch",
    "--config",
    new URL("./bundle.json", devDir).pathname,
    "--platform",
    "browser",
    "--sourcemap=inline",
    "--output",
    bundlePath.pathname,
    new URL("./client.tsx", devDir).pathname,
  ],
  cwd: new URL("../", devDir).pathname,
  stdout: "inherit",
  stderr: "inherit",
}).spawn();

function stopBundler() {
  try {
    bundler.kill("SIGTERM");
  } catch {
    // The bundler has already exited.
  }
}

Deno.addSignalListener("SIGINT", () => {
  stopBundler();
  Deno.exit(0);
});

const bundlerExited = bundler.status;
await waitForBundle(bundlePath, bundlerExited);

let published = await stampOf(bundlePath);
void watchBundle();

const page = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Shipyard</title>
  <link rel="stylesheet" href="/host.css">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div class="shell">
    <header class="dev-bar">
      <h1>Shipyard</h1>
      <p id="dev-status" class="meta">Standalone dev instance. Saved designs stay in this browser.</p>
    </header>
    <div id="shipyard"></div>
  </div>
  <script type="module" src="/app.js"></script>
  <script>
    const source = new EventSource("/dev/reload");
    source.onmessage = () => location.reload();
  </script>
</body>
</html>
`;

console.log(`Shipyard dev instance at http://127.0.0.1:${port}`);

Deno.serve({ port, hostname: "127.0.0.1" }, (request) => {
  const url = new URL(request.url);
  if (url.pathname === "/") return html(page);
  if (url.pathname === "/host.css") {
    return file(new URL("./host.css", devDir), "text/css");
  }
  if (url.pathname === "/styles.css") {
    return file(new URL("../styles.css", devDir), "text/css");
  }
  if (url.pathname === "/app.js") return file(bundlePath, "text/javascript");
  if (url.pathname === "/dev/reload") return reloadStream();
  return new Response("Not found", { status: 404 });
});

function html(body: string): Response {
  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function file(path: URL, type: string): Promise<Response> {
  try {
    const bytes = await Deno.readFile(path);
    return new Response(bytes, {
      headers: {
        "content-type": `${type}; charset=utf-8`,
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response("Not ready", { status: 503 });
  }
}

function reloadStream(): Response {
  let send: (stamp: string) => void = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      send = (stamp) =>
        controller.enqueue(encoder.encode(`data: ${stamp}\n\n`));
      listeners.add(send);
    },
    cancel() {
      listeners.delete(send);
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
    },
  });
}

async function watchBundle() {
  while (true) {
    const next = await stampOf(bundlePath);
    if (next && next !== published) {
      published = next;
      for (const send of listeners) send(next);
    }
    await delay(200);
  }
}

async function waitForBundle(path: URL, exited: Promise<Deno.CommandStatus>) {
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    if (await stampOf(path)) return;
    const status = await Promise.race([exited, delay(100).then(() => null)]);
    if (status) {
      throw new Error(
        `Bundler exited with code ${status.code} before writing the client.`,
      );
    }
  }
  throw new Error("Timed out waiting for the browser bundle.");
}

async function stampOf(path: URL): Promise<string | null> {
  try {
    const info = await Deno.stat(path);
    if (!info.isFile || info.size === 0) return null;
    return `${info.mtime?.getTime() ?? 0}:${info.size}`;
  } catch {
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

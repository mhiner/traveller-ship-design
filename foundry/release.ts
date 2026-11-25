/** Files copied as themselves. The build must already have written the bundles and stylesheet. */
const FILES = [
  "module.json",
  "dist/preact.js",
  "dist/blueprint.js",
  "styles/blueprint.css",
  "lang/en.json"
];

/** Directories copied with their contents. Source, tests, and the build script stay out. */
const DIRECTORIES = ["module", "templates"];

const repo = new URL("../", import.meta.url);
const foundry = new URL("./", import.meta.url);
const release = new URL("./release/", import.meta.url);

await run("deno", ["task", "foundry"], fileUrl(repo));

const manifest = JSON.parse(await Deno.readTextFile(new URL("module.json", foundry))) as {
  id?: string;
  version?: string;
};
const id = manifest.id?.trim() ?? "";
const version = manifest.version?.trim() ?? "";
if (!id || !version) throw new Error("module.json needs an id and a version");

await Deno.remove(release, { recursive: true }).catch(() => {});
const stage = new URL(`${id}/`, release);
await Deno.mkdir(stage, { recursive: true });

for (const path of FILES) {
  await copyFile(new URL(path, foundry), new URL(path, stage));
}
for (const path of DIRECTORIES) {
  await copyTree(new URL(`${path}/`, foundry), new URL(`${path}/`, stage));
}

const zipName = "module.zip";
await run("zip", ["-r", "-X", zipName, id], fileUrl(release));
await Deno.remove(stage, { recursive: true });

console.log(`Foundry release: foundry/release/${zipName}`);
console.log("Foundry release manifest: foundry/release/module.json");

/** Copies one file, creating parent directories. A missing source stops the release. */
async function copyFile(source: URL, destination: URL): Promise<void> {
  try {
    await Deno.stat(source);
  } catch {
    throw new Error(`release is missing ${fileUrl(source)}`);
  }
  await Deno.mkdir(new URL("./", destination), { recursive: true });
  await Deno.copyFile(source, destination);
  if (source.pathname.endsWith("/module.json")) {
    await Deno.copyFile(source, new URL("module.json", release));
  }
}

/** Copies a directory tree. Only files and folders are kept. */
async function copyTree(source: URL, destination: URL): Promise<void> {
  await Deno.mkdir(destination, { recursive: true });
  for await (const entry of Deno.readDir(source)) {
    const from = new URL(entry.name, source);
    const to = new URL(entry.name, destination);
    if (entry.isDirectory) await copyTree(new URL(`${entry.name}/`, source), new URL(`${entry.name}/`, destination));
    else if (entry.isFile) await Deno.copyFile(from, to);
  }
}

/** Filesystem path for a file URL. */
function fileUrl(url: URL): string {
  return url.pathname;
}

/** Runs a command in a directory and prints its output. A failed command stops the release. */
async function run(command: string, args: string[], cwd: string): Promise<void> {
  let result: Deno.CommandOutput;
  try {
    result = await new Deno.Command(command, { args, cwd }).output();
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      throw new Error(`${command} is not installed`);
    }
    throw error;
  }
  const output = new TextDecoder().decode(result.stdout) +
    new TextDecoder().decode(result.stderr);
  if (output.trim()) console.log(output.trim());
  if (!result.success) Deno.exit(result.code);
}

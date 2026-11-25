import type {
  AdvancedDesign,
  CrewLine,
  DesignLine,
  DesignSheet,
  LineRole,
} from "./design.ts";
import {
  ARMOUR,
  CONFIGURATIONS,
  customAdjustment,
  deepScanNote,
  DRIVE_OPTIONS,
  HULL_TYPES,
  parseMountLine,
  PRESSURE_HULL_ARMOUR,
} from "./tables.ts";

const ARMOUR_LABELS = ARMOUR.filter((row) => row.id !== "none").map((row) =>
  row.label
);
const ROLE_SECTION: Record<LineRole, Section> = {
  hull: "hull",
  hullOption: "hull",
  module: "craft",
  armour: "armour",
  manoeuvre: "mdrive",
  jump: "jdrive",
  plant: "plant",
  fuel: "fuel",
  bridge: "bridge",
  controls: "bridge",
  sensorStation: "bridge",
  computer: "computer",
  software: "software",
  sensors: "sensors",
  sensorExtra: "sensors",
  turret: "weapons",
  mount: "weapons",
  weapon: "weapons",
  dock: "craft",
  craft: "craft",
  accommodation: "accommodation",
  common: "common",
  robotics: "systems",
  roboticsOption: "systems",
  brain: "systems",
  system: "systems",
};

type Section =
  | "hull"
  | "armour"
  | "mdrive"
  | "jdrive"
  | "plant"
  | "fuel"
  | "bridge"
  | "computer"
  | "software"
  | "sensors"
  | "weapons"
  | "craft"
  | "systems"
  | "accommodation"
  | "common";

const SECTION_ORDER: Section[] = [
  "hull",
  "armour",
  "mdrive",
  "jdrive",
  "plant",
  "fuel",
  "bridge",
  "computer",
  "sensors",
  "weapons",
  "craft",
  "systems",
  "accommodation",
  "software",
  "common",
];

const SECTION_TITLE: Record<Section, string> = {
  hull: "Hull",
  armour: "Armour",
  mdrive: "M-Drive",
  jdrive: "J-Drive",
  plant: "Power Plant",
  fuel: "Fuel Tanks",
  bridge: "Bridge",
  computer: "Computer",
  software: "Software",
  sensors: "Sensors",
  weapons: "Weapons",
  craft: "Craft",
  systems: "Systems",
  accommodation: "Staterooms",
  common: "Common Areas",
};

/** Monthly maintenance is one twelfth of the annual tenth of a percent of the purchase price. */
const MAINTENANCE_DIVISOR = 12000;

function amount(value: number): string {
  return String(Math.round(value * 10000) / 10000);
}

function cell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function tonsCell(value: number): string {
  return value ? amount(value) : "—";
}

function costCell(value: number): string {
  return value ? amount(value) : "—";
}

function sectionOf(line: DesignLine): Section {
  return ROLE_SECTION[line.role];
}

function weeksLabel(weeks: number): string {
  return `${weeks} week${weeks === 1 ? "" : "s"} of operation`;
}

function computerLabel(name: string): string {
  return name.replace(" bis+fib", "bis,fib").replace(" bis", "bis").replace(
    " fib",
    "fib",
  );
}

function combineWeapons(lines: DesignLine[]): DesignLine[] {
  const combined: DesignLine[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.role !== "turret" && line.role !== "mount") {
      combined.push(line);
      continue;
    }
    const mount = parseMountLine(line.name);
    const fitted: DesignLine[] = [];
    while (index + 1 < lines.length && lines[index + 1].role === "weapon") {
      index += 1;
      fitted.push(lines[index]);
    }
    const counts = new Map<string, number>();
    for (const weapon of fitted) {
      counts.set(weapon.name, (counts.get(weapon.name) ?? 0) + 1);
    }
    const parts = [
      ...(mount?.popup ? ["pop-up"] : []),
      ...[...counts].map(([name, count]) =>
        count > 1 ? `${name} x${count}` : name
      ),
    ];
    combined.push({
      role: line.role,
      name: parts.length
        ? `${mount?.label ?? line.name} (${parts.join(", ")})`
        : `${mount?.label ?? line.name} (empty)`,
      tons: line.tons,
      cost: Math.round(
        (line.cost + fitted.reduce((total, weapon) => total + weapon.cost, 0)) *
          10000,
      ) / 10000,
    });
  }
  return combined;
}

function specifiedDrive(name: string): { rating: string; tons: string } {
  const match = /(\d+)(?: \(([^)]* tons)\))?$/.exec(name);
  return { rating: match?.[1] ?? "", tons: match?.[2] ?? "" };
}

function detail(
  section: Section,
  line: DesignLine,
  design: AdvancedDesign,
  sheet: DesignSheet,
): { label: string; tons: number } {
  if (section === "hull" && line.role === "hull") {
    const configuration = CONFIGURATIONS.find((row) =>
      row.id === design.configuration
    );
    const hullType = HULL_TYPES.find((row) => row.id === design.hullType);
    const parts = [
      `${design.hullTons} tons`,
      configuration?.label ?? "Standard",
    ];
    if (hullType && hullType.id !== "standard") parts.push(hullType.label);
    const intrinsic = (configuration?.armourBonus ?? 0) +
      (design.hullOptions.some((option) => option.kind === "pressure")
        ? PRESSURE_HULL_ARMOUR
        : 0);
    if (design.hullType !== "module" && intrinsic > 0) {
      parts.push(`Armour: ${intrinsic}`);
    }
    return { label: parts.join(", "), tons: 0 };
  }
  if (section === "armour") {
    const label = ARMOUR_LABELS.find((name) =>
      line.name.startsWith(`${name} `)
    ) ?? line.name;
    return {
      label: `${label}, Armour: ${design.armourRating}`,
      tons: line.tons,
    };
  }
  if (section === "mdrive") {
    const specified = specifiedDrive(line.name);
    const options =
      customAdjustment(DRIVE_OPTIONS.thrust, design.driveCustom?.thrust).label;
    const extra = [specified.tons, options].filter(Boolean).join(", ");
    return {
      label: extra
        ? `Thrust ${specified.rating} (${extra})`
        : `Thrust ${specified.rating}`,
      tons: line.tons,
    };
  }
  if (section === "jdrive") {
    const specified = specifiedDrive(line.name);
    return {
      label: specified.tons
        ? `Jump ${specified.rating} (${specified.tons})`
        : `Jump ${specified.rating}`,
      tons: line.tons,
    };
  }
  if (section === "plant") {
    return {
      label: `${line.name}, Power ${amount(design.power)}`,
      tons: line.tons,
    };
  }
  if (section === "fuel" && line.name === "Fuel tank") {
    const jump = sheet.jumpRating > 0 ? `J-${sheet.jumpRating}, ` : "";
    return {
      label: `${jump}${
        weeksLabel(Math.max(1, Math.trunc(design.powerWeeks) || 1))
      }`,
      tons: line.tons,
    };
  }
  if (section === "fuel" && line.name.startsWith("Fuel/cargo container")) {
    return {
      label: line.name.replace(/ \((\d+) t\)$/, " ($1 tons)"),
      tons: line.tons,
    };
  }
  if (section === "computer") {
    return { label: computerLabel(line.name), tons: line.tons };
  }
  if (section === "sensors" && line.name.endsWith(" sensors")) {
    return {
      label: `${line.name.slice(0, -" sensors".length)} Grade`,
      tons: line.tons,
    };
  }
  if (section === "sensors" && line.name === "Deep Penetration Scanners") {
    const note = deepScanNote(line.tons);
    return {
      label: note ? `Deep Penetration Scanners (${note})` : line.name,
      tons: line.tons,
    };
  }
  if (section === "systems" && line.name === "Fuel processors") {
    return {
      label: `Fuel processor (${Math.round(line.tons) * 20} tons/day)`,
      tons: line.tons,
    };
  }
  if (section === "accommodation" && line.name === "Staterooms") {
    const doubles = Math.min(
      design.staterooms,
      Math.max(0, Math.trunc(design.doubleStaterooms) || 0),
    );
    const label = doubles > 0
      ? `Standard x${design.staterooms} (${doubles} double occupancy)`
      : `Standard x${design.staterooms}`;
    return { label, tons: line.tons };
  }
  if (section === "accommodation" && line.name === "High staterooms") {
    return { label: `High x${design.highStaterooms}`, tons: line.tons };
  }
  if (section === "accommodation" && line.name === "Luxury staterooms") {
    return { label: `Luxury x${design.luxuryStaterooms}`, tons: line.tons };
  }
  if (section === "accommodation" && line.name === "Low berths") {
    return { label: `Low berths x${design.lowBerths}`, tons: line.tons };
  }
  if (section === "accommodation" && line.name === "Emergency low berths") {
    return {
      label: `Emergency low berths x${design.emergencyLowBerths}`,
      tons: line.tons,
    };
  }
  if (section === "accommodation" && line.name === "Cabin space") {
    return { label: `Cabin space x${design.cabinSpaces}`, tons: line.tons };
  }
  if (section === "accommodation" && line.name === "Acceleration benches") {
    return {
      label: `Acceleration benches x${design.accelerationBenches}`,
      tons: line.tons,
    };
  }
  if (section === "accommodation" && line.name === "Acceleration seats") {
    return {
      label: `Acceleration seats x${design.accelerationSeats}`,
      tons: line.tons,
    };
  }
  if (section === "accommodation" && line.name === "Barracks") {
    return { label: `Barracks x${design.barracks}`, tons: line.tons };
  }
  if (section === "accommodation" && line.name === "Brig") {
    return { label: `Brig x${design.brigs}`, tons: line.tons };
  }
  if (section === "common") return { label: "Common Areas", tons: line.tons };
  return { label: line.name, tons: line.tons };
}

function componentTable(design: AdvancedDesign, sheet: DesignSheet): string {
  const grouped = new Map<Section, DesignLine[]>();
  for (const line of sheet.lines) {
    const section = sectionOf(line);
    const rows = grouped.get(section) ?? [];
    rows.push(line);
    grouped.set(section, rows);
  }
  const table: string[][] = [];
  for (const section of SECTION_ORDER) {
    const source = grouped.get(section) ?? [];
    if (source.length === 0) continue;
    const rows = section === "weapons" ? combineWeapons(source) : source;
    const inline = section === "bridge" || section === "common";
    if (!inline) table.push([`**${SECTION_TITLE[section]}**`, "", ""]);
    for (const line of rows) {
      const row = detail(section, line, design, sheet);
      const label = inline ? `**${row.label}**` : row.label;
      table.push([label, tonsCell(row.tons), costCell(line.cost)]);
    }
  }
  table.push(["**Cargo**", amount(sheet.cargo), "—"]);
  const total = sheet.lines.reduce((sum, line) => sum + line.cost, 0);
  table.push(["**Total**", "", `**${amount(total)}**`]);
  const body = table.map((row) => `| ${row.map(cell).join(" | ")} |`).join(
    "\n",
  );
  return `| | Tons | Cost (MCr) |\n| --- | ---: | ---: |\n${body}`;
}

function powerRequirements(
  sheet: DesignSheet,
): { name: string; points: number }[] {
  const requirements: { name: string; points: number }[] = [];
  const hull = sheet.lines.find((line) => line.role === "hull");
  if (hull?.power) {
    requirements.push({ name: "Basic Ship Systems", points: hull.power });
  }
  const manoeuvre = sheet.lines.find((line) => line.role === "manoeuvre");
  if (manoeuvre?.power) {
    requirements.push({ name: "Manoeuvre Drive", points: manoeuvre.power });
  }
  const jump = sheet.lines.find((line) => line.role === "jump");
  if (jump?.power) {
    requirements.push({ name: "Jump Drive", points: jump.power });
  }
  if (sheet.powerUse.sensors) {
    requirements.push({ name: "Sensors", points: sheet.powerUse.sensors });
  }
  const weaponRoles = new Set<LineRole>(["turret", "mount", "weapon"]);
  const weaponPoints = sheet.lines.reduce(
    (total, line) =>
      total +
      (!line.carried && line.power && weaponRoles.has(line.role)
        ? line.power
        : 0),
    0,
  );
  if (weaponPoints) {
    requirements.push({ name: "Weapons", points: weaponPoints });
  }
  const summarized = new Set<LineRole>([
    "hull",
    "manoeuvre",
    "jump",
    "plant",
    "sensors",
    "sensorExtra",
    "turret",
    "mount",
    "weapon",
  ]);
  for (const line of sheet.lines) {
    if (!line.power || line.carried || summarized.has(line.role)) continue;
    requirements.push({ name: line.name, points: line.power });
  }
  for (const line of sheet.lines) {
    if (line.carried && line.power) {
      requirements.push({ name: line.name, points: line.power });
    }
  }
  return requirements;
}

function powerTable(sheet: DesignSheet): string {
  const body = powerRequirements(sheet).map((row) =>
    `| ${cell(row.name)} | ${amount(row.points)} |`
  ).join("\n");
  return `| | Points |\n| --- | ---: |\n${body}`;
}

function crewText(crew: CrewLine[]): string {
  return crew.map((row) =>
    row.count > 1 ? `${row.role}s x${row.count}` : row.role
  ).join(", ");
}

/** High Guard stat block for a design, as Markdown. */
export function shipStatMarkdown(
  design: AdvancedDesign,
  sheet: DesignSheet,
): string {
  const title = design.name.trim() || "Ship";
  const maintenance = Math.round(
    Math.round(sheet.cost * 1_000_000) / MAINTENANCE_DIVISOR,
  );
  return [
    `# ${title.replace(/[#\n]/g, "").trim() || "Ship"}`,
    "",
    `**TL${
      Math.max(0, Math.trunc(design.techLevel))
    }** · Hull ${sheet.hullPoints}`,
    "",
    componentTable(design, sheet),
    "",
    `**Crew** ${crewText(sheet.crew)}`,
    "",
    "**Running Costs**",
    "",
    `Maintenance cost Cr${maintenance}/month`,
    "",
    `Purchase cost MCr${amount(sheet.cost)}`,
    "",
    "**Power Requirements**",
    "",
    powerTable(sheet),
    "",
  ].join("\n");
}

interface PublicationRow {
  category: string;
  detail: string;
  tons: string;
  cost: string;
  total: boolean;
}

function publicationRows(
  design: AdvancedDesign,
  sheet: DesignSheet,
): PublicationRow[] {
  const grouped = new Map<Section, DesignLine[]>();
  for (const line of sheet.lines) {
    const section = sectionOf(line);
    const rows = grouped.get(section) ?? [];
    rows.push(line);
    grouped.set(section, rows);
  }
  const table: PublicationRow[] = [];
  for (const section of SECTION_ORDER) {
    const source = grouped.get(section) ?? [];
    if (source.length === 0) continue;
    const rows = section === "weapons" ? combineWeapons(source) : source;
    const inline = section === "bridge" || section === "common";
    rows.forEach((line, index) => {
      const row = detail(section, line, design, sheet);
      table.push({
        category: index === 0
          ? (inline ? row.label : SECTION_TITLE[section])
          : "",
        detail: inline ? "" : row.label,
        tons: tonsCell(row.tons),
        cost: costCell(line.cost),
        total: false,
      });
    });
  }
  const total = sheet.lines.reduce((sum, line) => sum + line.cost, 0);
  table.push({
    category: "Cargo",
    detail: "",
    tons: amount(sheet.cargo),
    cost: "—",
    total: false,
  });
  table.push({
    category: "Total",
    detail: "",
    tons: "",
    cost: amount(total),
    total: true,
  });
  return table;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function credits(value: number): string {
  return `Cr${value.toLocaleString("en-US")}`;
}

/** Download name for the self-contained stat block. */
export function statHtmlFilename(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(
    /^-|-$/g,
    "",
  );
  return `${slug || "ship"}.html`;
}

const STAT_CSS = `
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      background: #f3efe6;
      color: #1c1915;
      font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      font-size: 15px;
      line-height: 1.35;
    }
    article {
      max-width: 980px;
      margin: 1.5rem auto;
      background: #fffdf8;
      border: 1px solid #d9d0c1;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: stretch;
      background: #6e1d2a;
      color: #fffdf8;
    }
    .title { padding: 0.85rem 1.15rem 0.75rem; }
    h1 {
      margin: 0;
      font-family: "Arial Narrow", "Segoe UI", Arial, sans-serif;
      font-size: 1.85rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
    }
    .class {
      margin: 0.15rem 0 0;
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .tl {
      margin: 0;
      display: grid;
      place-items: center;
      min-width: 4.5rem;
      padding: 0.85rem 1rem;
      background: #c4a15a;
      color: #1c1915;
      font-weight: 700;
      letter-spacing: 0.08em;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1.75fr) minmax(16rem, 0.85fr);
      align-items: start;
    }
    table { width: 100%; border-collapse: collapse; }
    th {
      padding: 0.55rem 0.5rem 0.35rem;
      border-bottom: 2px solid #6e1d2a;
      color: #6e1d2a;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-align: right;
      text-transform: uppercase;
    }
    th.detail { text-align: left; }
    td { padding: 0.18rem 0.5rem; vertical-align: baseline; }
    td.cat {
      width: 7.4rem;
      color: #6e1d2a;
      font-weight: 700;
      white-space: nowrap;
    }
    td.num {
      width: 5.8rem;
      text-align: right;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    tr.total td {
      border-top: 2px solid #1c1915;
      font-weight: 700;
      padding-top: 0.45rem;
    }
    aside {
      border-left: 1px solid #d9d0c1;
      padding: 0.85rem 1rem 1.1rem;
      background: #faf7f1;
    }
    aside h2 {
      margin: 1rem 0 0.3rem;
      color: #6e1d2a;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    aside h2:first-child { margin-top: 0; }
    .crew, .hull-points { margin: 0; }
    .hull-points { margin-top: 0.35rem; }
    .cost-line, .power-line {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      margin: 0.12rem 0;
    }
    .cost-line span:last-child, .power-line span:last-child {
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    @media (max-width: 760px) {
      .layout { grid-template-columns: 1fr; }
      aside { border-left: 0; border-top: 1px solid #d9d0c1; }
    }
    @media print {
      html, body { background: white; }
      article { margin: 0; border: 0; }
    }
`;

function statArticle(design: AdvancedDesign, sheet: DesignSheet): string {
  const title = design.name.trim() || "Ship";
  const rows = publicationRows(design, sheet).map((row) => {
    const cls = row.total ? ` class="total"` : "";
    return `<tr${cls}><td class="cat">${escapeHtml(row.category)}</td><td>${
      escapeHtml(row.detail)
    }</td><td class="num">${escapeHtml(row.tons)}</td><td class="num">${
      escapeHtml(row.cost)
    }</td></tr>`;
  }).join("");
  const powers = powerRequirements(sheet).map((row) =>
    `<p class="power-line"><span>${escapeHtml(row.name)}</span><span>${
      escapeHtml(amount(row.points))
    }</span></p>`
  ).join("");
  const maintenance = Math.round(
    Math.round(sheet.cost * 1_000_000) / MAINTENANCE_DIVISOR,
  );
  const crew = sheet.crew.length ? crewText(sheet.crew) : "—";
  return `<article>
    <header>
      <div class="title">
        <h1>${escapeHtml(title)}</h1>
        <p class="class">${escapeHtml(design.classification)}</p>
      </div>
      <p class="tl">TL${Math.max(0, Math.trunc(design.techLevel))}</p>
    </header>
    <div class="layout">
      <table>
        <thead>
          <tr><th class="detail"></th><th class="detail"></th><th>Tons</th><th>Cost (MCr)</th></tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      <aside>
        <h2>Crew</h2>
        <p class="crew">${escapeHtml(crew)}</p>
        <p class="hull-points">Hull <strong>${sheet.hullPoints}</strong></p>
        <h2>Running Costs</h2>
        <p class="cost-line"><span>Maintenance cost</span><span>${
    credits(maintenance)
  }/month</span></p>
        <p class="cost-line"><span>Purchase cost</span><span>MCr${
    escapeHtml(amount(sheet.cost))
  }</span></p>
        <h2>Power Requirements</h2>
        ${powers}
      </aside>
    </div>
  </article>`;
}

/** High Guard stat blocks as one HTML file, with styles embedded. */
export function shipStatsHtml(
  title: string,
  parts: readonly { design: AdvancedDesign; sheet: DesignSheet }[],
): string {
  const safeTitle = escapeHtml(title.trim() || "Ship");
  const articles = parts.map((part) => statArticle(part.design, part.sheet))
    .join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${safeTitle}</title>
  <style>${STAT_CSS}</style>
</head>
<body>
  ${articles}
</body>
</html>
`;
}

/** High Guard stat block as one HTML file, with its styles embedded. */
export function shipStatHtml(
  design: AdvancedDesign,
  sheet: DesignSheet,
): string {
  return shipStatsHtml(design.name, [{ design, sheet }]);
}

import { useEffect, useRef, useState } from "../runtime.ts";
import { exportStatBlocks } from "../combined.ts";
import {
  type AdvancedDesign,
  blankDesign,
  blankModule,
  evaluateDesign,
} from "../design.ts";
import { designBundleFromJson, designForExport } from "../store.ts";
import { shipStatsHtml, statHtmlFilename } from "../statblock.ts";
import { armourAt } from "../catalog/hull.ts";
import { JUMP_MIN_HULL_TONS, powerPlantsAt } from "../catalog/drives.ts";
import { STANDARD_DESIGNS } from "../templates.ts";
import { shipDesignFromAdvanced } from "../toShipDesign.ts";
import type { ShipyardEmit } from "../events.ts";
import type { DesignStorage } from "../storage.ts";
import { SHIP_CLASSIFICATIONS } from "../classification.ts";
import { AccommodationsSection } from "./design/AccommodationsSection.tsx";
import { BridgeSection } from "./design/BridgeSection.tsx";
import { DesignSheets } from "./design/DesignSheets.tsx";
import { DocksSection } from "./design/DocksSection.tsx";
import { DrivesSection } from "./design/DrivesSection.tsx";
import { HullSection } from "./design/HullSection.tsx";
import { freshId } from "./design/shared.tsx";
import { WeaponsSection } from "./design/WeaponsSection.tsx";
import { NumberField, TextField } from "./fields.tsx";

function sameDesign(left: unknown, right: unknown): boolean {
  return canonical(left) === canonical(right);
}

function withoutId(design: AdvancedDesign): Omit<AdvancedDesign, "id"> {
  const { id: _id, ...rest } = design;
  return rest;
}

/** True when the open draft is still a catalog design, ignoring its id. */
function stockCatalogDraft(draft: AdvancedDesign): boolean {
  const body = withoutId(draft);
  return STANDARD_DESIGNS.some((design) => sameDesign(body, withoutId(design)));
}

/** An open stock ship can be built without saving a personal copy. */
function stockShipDraft(draft: AdvancedDesign): boolean {
  return draft.hullType !== "module" && stockCatalogDraft(draft);
}

function canonical(value: unknown): string {
  return JSON.stringify(sorted(value));
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce<Record<string, unknown>>(
      (out, key) => {
        const entry = (value as Record<string, unknown>)[key];
        if (entry !== undefined) out[key] = sorted(entry);
        return out;
      },
      {},
    );
  }
  return value;
}

function copyName(name: string, taken: ReadonlySet<string>): string {
  const stem = name.replace(/ copy(?: \d+)?$/, "");
  const first = `${stem} copy`;
  if (!taken.has(first)) return first;
  let count = 2;
  while (taken.has(`${stem} copy ${count}`)) count += 1;
  return `${stem} copy ${count}`;
}

function designJsonFilename(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(
    /^-|-$/g,
    "",
  );
  return `${slug || "ship"}.json`;
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
      />
    </svg>
  );
}

function Pencil({ label, onEdit }: { label: string; onEdit: () => void }) {
  return (
    <button
      type="button"
      className="edit-field"
      aria-label={`Edit ${label}`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onEdit}
    >
      <PencilIcon />
    </button>
  );
}

function downloadShipStat(
  design: AdvancedDesign,
  catalog: readonly AdvancedDesign[],
): void {
  const parts = exportStatBlocks(design, catalog);
  const blob = new Blob([shipStatsHtml(design.name, parts)], {
    type: "text/html",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = statHtmlFilename(design.name);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface Props {
  storage: DesignStorage;
  emit: ShipyardEmit;
  requestedDesign?: { name: string; token: number } | null;
  hidden?: boolean;
}

export function ShipyardView(
  { storage, emit, requestedDesign = null, hidden = false }: Props,
) {
  const [designs, setDesigns] = useState<AdvancedDesign[]>([]);
  const [modules, setModules] = useState<AdvancedDesign[]>([]);
  const [draft, setDraft] = useState<AdvancedDesign>(() =>
    blankDesign(freshId())
  );
  const [message, setMessage] = useState("");
  const [messageBad, setMessageBad] = useState(false);
  const [blueprintQuery, setBlueprintQuery] = useState("");
  const [showShips, setShowShips] = useState(true);
  const [showModules, setShowModules] = useState(true);
  const [stockShipsOnly, setStockShipsOnly] = useState(false);
  const [minTonnage, setMinTonnage] = useState(0);
  const [maxTonnage, setMaxTonnage] = useState(0);
  const [blueprintsOpen, setBlueprintsOpen] = useState(false);
  const [fromStock, setFromStock] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [editing, setEditing] = useState<
    "name" | "classification" | "tech" | null
  >(null);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const focusDescription = useRef(false);
  const nameInput = useRef<HTMLInputElement | null>(null);
  const classificationInput = useRef<HTMLSelectElement | null>(null);
  const techInput = useRef<HTMLInputElement | null>(null);
  const loadedDesigns = useRef(false);
  const loadedModules = useRef(false);
  const appliedDesign = useRef(0);
  const moduleDraft = draft.hullType === "module";
  const storedDesign = designs.find((row) => row.id === draft.id) ??
    modules.find((row) => row.id === draft.id);
  const designUnsaved = storedDesign === undefined ||
    !sameDesign(draft, storedDesign);
  const stockDraft = stockShipDraft(draft);
  const stockOpen = fromStock || stockCatalogDraft(draft);
  const catalog = [...STANDARD_DESIGNS, ...designs, ...modules];
  const sheet = evaluateDesign(draft, catalog);
  const stockIds = new Set(STANDARD_DESIGNS.map((design) => design.id));
  const blueprints = [
    ...designs.map((design) => ({ design, stock: stockIds.has(design.id) })),
    ...modules.filter((design) => !designs.some((row) => row.id === design.id))
      .map((design) => ({ design, stock: stockIds.has(design.id) })),
    ...STANDARD_DESIGNS.map((design) => ({ design, stock: true })),
  ].sort((a, b) =>
    a.design.name.localeCompare(b.design.name) ||
    Number(b.stock) - Number(a.stock) || a.design.hullTons - b.design.hullTons
  );
  const tonnageBound = (value: number) =>
    Number.isFinite(value) && value > 0 ? value : 0;
  const minimumTonnage = tonnageBound(minTonnage);
  const maximumTonnage = tonnageBound(maxTonnage);
  const query = blueprintQuery.trim().toLowerCase();
  const visibleBlueprints = blueprints.filter(({ design, stock }) => {
    const moduleHull = design.hullType === "module";
    if (moduleHull ? !showModules : !showShips) return false;
    if (stockShipsOnly && !stock) return false;
    if (query && !design.name.toLowerCase().includes(query)) return false;
    if (minimumTonnage > 0 && design.hullTons < minimumTonnage) return false;
    if (maximumTonnage > 0 && design.hullTons > maximumTonnage) return false;
    return true;
  });

  useEffect(() => {
    let live = true;
    storage.loadDesigns().then((stored) => {
      if (!live) return;
      loadedDesigns.current = true;
      setDesigns(stored);
    });
    storage.loadModules().then((stored) => {
      if (!live) return;
      loadedModules.current = true;
      setModules(stored);
    });
    return () => {
      live = false;
    };
  }, [storage]);

  useEffect(() => {
    if (!loadedDesigns.current || !loadedModules.current) return;
    if (!requestedDesign || requestedDesign.token === appliedDesign.current) {
      return;
    }
    appliedDesign.current = requestedDesign.token;
    const wanted = requestedDesign.name.trim().toLowerCase();
    const matches = blueprints.filter((row) =>
      row.design.name.trim().toLowerCase() === wanted
    );
    const chosen = matches.find((row) => !row.stock) ?? matches[0];
    if (!chosen) {
      emit("designMissing");
      return;
    }
    setFromStock(chosen.stock);
    setDraft(
      chosen.stock ? { ...chosen.design, id: freshId() } : { ...chosen.design },
    );
    setBlueprintsOpen(false);
  }, [requestedDesign, designs, modules]);

  useEffect(() => {
    if (!loadedDesigns.current) return;
    void storage.saveDesigns(designs).then(() => emit("stored"));
  }, [designs, storage]);

  useEffect(() => {
    if (!loadedModules.current) return;
    void storage.saveModules(modules).then(() => emit("stored"));
  }, [modules, storage]);

  const announcedDraft = useRef(false);
  useEffect(() => {
    if (!announcedDraft.current) {
      announcedDraft.current = true;
      return;
    }
    emit("draft", draft);
  }, [draft, emit]);

  useEffect(() => {
    setEditing(null);
  }, [draft.id]);

  useEffect(() => {
    if (editing === "name") nameInput.current?.focus();
    if (editing === "classification") classificationInput.current?.focus();
    if (editing === "tech") techInput.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!descriptionOpen || !focusDescription.current) return;
    focusDescription.current = false;
    descriptionRef.current?.focus();
  }, [descriptionOpen]);

  const note = (text: string, bad = false) => {
    setMessage(text);
    setMessageBad(bad);
  };

  const patch = (next: Partial<AdvancedDesign>) => {
    setDraft((current) => ({ ...current, ...next }));
    note("");
  };

  const setTechLevel = (techLevel: number) => {
    const allowed = powerPlantsAt(techLevel);
    const powerPlant = allowed.some((plant) => plant.id === draft.powerPlant)
      ? draft.powerPlant
      : allowed[allowed.length - 1]?.id ?? draft.powerPlant;
    const armourAllowed = armourAt(techLevel);
    const armour = armourAllowed.some((row) => row.id === draft.armour)
      ? draft.armour
      : armourAllowed[armourAllowed.length - 1]?.id ?? draft.armour;
    patch({ techLevel, powerPlant, armour });
  };

  const editDescription = () => {
    focusDescription.current = true;
    if (descriptionOpen) descriptionRef.current?.focus();
    else setDescriptionOpen(true);
  };

  const copyDesign = () => {
    const name = draft.name.trim();
    if (!name) {
      note("A design needs a name.", true);
      return;
    }
    const taken = new Set(
      (moduleDraft ? modules : designs).map((row) => row.name),
    );
    const copied = structuredClone(draft);
    copied.id = freshId();
    copied.name = copyName(name, taken);
    if (moduleDraft) setModules([...modules, copied]);
    else setDesigns([...designs, copied]);
    setFromStock(false);
    setDraft(copied);
    emit("designName", copied.name);
    note(`Copied ${copied.name}.`);
  };

  const save = () => {
    if (fromStock || stockCatalogDraft(draft)) {
      note("Copy a stock design before saving it.", true);
      return;
    }
    const name = draft.name.trim();
    if (!name) {
      note("A design needs a name.", true);
      return;
    }
    const jump = !moduleDraft && draft.hullTons < JUMP_MIN_HULL_TONS
      ? 0
      : draft.jump;
    const next = moduleDraft
      ? { ...draft, name, classification: "Other" as const }
      : { ...draft, name, jump };
    setDraft(next);
    const keep = (rows: AdvancedDesign[]) =>
      rows.filter((row) => row.id !== next.id);
    const store = (rows: AdvancedDesign[]) =>
      rows.some((row) => row.id === next.id)
        ? rows.map((row) => (row.id === next.id ? next : row))
        : [...rows, next];
    if (moduleDraft) {
      setModules(store(modules));
      setDesigns(keep(designs));
    } else {
      setDesigns(store(designs));
      setModules(keep(modules));
    }
    emit("designName", name);
    note(`Saved ${name}.`);
  };

  const removeDesign = (design: AdvancedDesign) => {
    const saved = designs.some((row) => row.id === design.id) ||
      modules.some((row) => row.id === design.id);
    if (!saved) return;
    if (!confirm(`Remove ${design.name}?`)) return;
    setDesigns(designs.filter((row) => row.id !== design.id));
    setModules(modules.filter((row) => row.id !== design.id));
    if (draft.id === design.id) {
      setDraft(
        design.hullType === "module"
          ? blankModule(freshId())
          : blankDesign(freshId()),
      );
      emit("designName", null);
    }
    note("");
  };

  const buildShip = () => {
    if (moduleDraft) {
      note("A module is not a ship.", true);
      return;
    }
    const name = draft.name.trim();
    if (!name) {
      note("A design needs a name.", true);
      return;
    }
    if (sheet.errors[0]) {
      note(sheet.errors[0], true);
      return;
    }
    const source = { ...draft, name };
    emit("build", {
      name,
      design: source,
      catalog,
      stats: shipDesignFromAdvanced(source, catalog),
    });
    note(`Built ${name}.`);
  };

  const exportDesign = () => {
    const name = draft.name.trim() || "design";
    const blob = new Blob([
      JSON.stringify(designForExport(draft, catalog), null, 2),
    ], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = designJsonFilename(name);
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    note(`Exported ${name}.`);
  };

  const importDesign = async (
    chosen: File | undefined,
    input: HTMLInputElement,
  ) => {
    if (!chosen) return;
    try {
      const parsed = designBundleFromJson(JSON.parse(await chosen.text()));
      if (!parsed) {
        note("That file is not a ship design.", true);
        return;
      }
      const known = new Set(
        [...STANDARD_DESIGNS, ...designs, ...modules].map((row) => row.id),
      );
      const extra = parsed.bundled.filter((row) =>
        row.id !== parsed.design.id && !known.has(row.id)
      );
      const extraShips = extra.filter((row) => row.hullType !== "module");
      const extraModules = extra.filter((row) => row.hullType === "module");
      if (extraShips.length > 0) setDesigns([...designs, ...extraShips]);
      if (extraModules.length > 0) setModules([...modules, ...extraModules]);
      setFromStock(false);
      setDraft({ ...parsed.design, id: freshId() });
      emit("designName", null);
      note(`Imported ${parsed.design.name}.`);
    } catch {
      note("Could not read that file.", true);
    } finally {
      input.value = "";
    }
  };

  return (
    <div className="split" hidden={hidden}>
      <div>
        <section className="panel">
          <div className="row design-actions">
            <button
              type="button"
              onClick={() => {
                setFromStock(false);
                setDraft(
                  moduleDraft ? blankModule(freshId()) : blankDesign(freshId()),
                );
                emit("designName", null);
                setBlueprintsOpen(false);
              }}
            >
              New
            </button>
            <button
              type="button"
              aria-pressed={blueprintsOpen}
              onClick={() => setBlueprintsOpen((open) => !open)}
            >
              Open
            </button>
            {blueprintsOpen ? null : (
              <>
                <button type="button" disabled={stockOpen} onClick={save}>
                  Save
                </button>
                <button
                  type="button"
                  disabled={designUnsaved && !stockOpen}
                  onClick={copyDesign}
                >
                  Copy
                </button>
                <button
                  type="button"
                  disabled={moduleDraft || (designUnsaved && !stockDraft)}
                  onClick={buildShip}
                >
                  Build ship
                </button>
                <button
                  type="button"
                  disabled={designUnsaved && !stockOpen}
                  onClick={() => downloadShipStat(draft, catalog)}
                >
                  Export HTML
                </button>
                <button
                  type="button"
                  disabled={designUnsaved && !stockOpen}
                  onClick={exportDesign}
                >
                  Export JSon
                </button>
                <label className="file-button">
                  Import
                  <input
                    type="file"
                    accept="application/json,.json"
                    disabled={designUnsaved}
                    onChange={(event) =>
                      void importDesign(
                        event.currentTarget.files?.[0],
                        event.currentTarget,
                      )}
                  />
                </label>
              </>
            )}
          </div>
          {message
            ? <p className={messageBad ? "error" : "meta"}>{message}</p>
            : null}
          {blueprintsOpen
            ? (
              <div className="design-list">
                <div className="blueprint-head">
                  <span className="blueprint-title">Blueprints</span>
                  <div className="blueprint-filters">
                    <TextField
                      label="Search"
                      value={blueprintQuery}
                      onChange={setBlueprintQuery}
                    />
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={showShips}
                        onChange={(event) =>
                          setShowShips(event.currentTarget.checked)}
                      />
                      Ships
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={showModules}
                        onChange={(event) =>
                          setShowModules(event.currentTarget.checked)}
                      />
                      Modules
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={stockShipsOnly}
                        onChange={(event) =>
                          setStockShipsOnly(event.currentTarget.checked)}
                      />
                      Stock Ships Only
                    </label>
                    <NumberField
                      label="Min Tonnage"
                      value={minTonnage}
                      min={0}
                      onChange={setMinTonnage}
                    />
                    <NumberField
                      label="Max Tonnage"
                      value={maxTonnage}
                      min={0}
                      onChange={setMaxTonnage}
                    />
                  </div>
                </div>
                <ul className="list">
                  {visibleBlueprints.length === 0
                    ? <li className="meta">No blueprints match.</li>
                    : null}
                  {visibleBlueprints.map(({ design, stock }) => (
                    <li key={design.id} className="blueprint-row">
                      <button
                        type="button"
                        aria-current={stock
                          ? draft.name === design.name &&
                              draft.standardDesign === design.standardDesign
                            ? "true"
                            : undefined
                          : design.id === draft.id
                          ? "true"
                          : undefined}
                        onClick={() => {
                          setFromStock(stock);
                          setDraft(
                            stock
                              ? { ...design, id: freshId() }
                              : { ...design },
                          );
                          emit("designName", design.name);
                          setBlueprintsOpen(false);
                        }}
                      >
                        {design.name} · {design.hullTons} t ·{" "}
                        {design.hullType === "module" ? "module" : "ship"}
                        {stock ? " · stock design" : ""}
                      </button>
                      {stock ? null : (
                        <button
                          type="button"
                          onClick={() => removeDesign(design)}
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )
            : null}
        </section>
        <section className="panel design-form" hidden={blueprintsOpen}>
          <div className="ship-title">
            <div className="ship-heading">
              <h2>
                {editing === "name"
                  ? (
                    <input
                      aria-label="Name"
                      value={draft.name}
                      ref={nameInput}
                      onBlur={() =>
                        setEditing((current) =>
                          current === "name" ? null : current
                        )}
                      onChange={(event) =>
                        patch({ name: event.currentTarget.value })}
                    />
                  )
                  : <span>{draft.name.trim() || "Design"}</span>}
                <Pencil label="name" onEdit={() => setEditing("name")} />
              </h2>
              <span className="ship-title-field">
                <span className="ship-title-label">Classification</span>
                {editing === "classification" && !moduleDraft
                  ? (
                    <select
                      aria-label="Classification"
                      value={draft.classification}
                      ref={classificationInput}
                      onBlur={() =>
                        setEditing((current) =>
                          current === "classification" ? null : current
                        )}
                      onChange={(event) =>
                        patch({
                          classification: event.currentTarget
                            .value as AdvancedDesign["classification"],
                        })}
                    >
                      {SHIP_CLASSIFICATIONS.map((classification) => (
                        <option key={classification} value={classification}>
                          {classification}
                        </option>
                      ))}
                    </select>
                  )
                  : <span>{moduleDraft ? "Other" : draft.classification}</span>}
                {moduleDraft ? null : (
                  <Pencil
                    label="classification"
                    onEdit={() => setEditing("classification")}
                  />
                )}
              </span>
              <span className="ship-title-field">
                <span className="ship-title-label">TL</span>
                {editing === "tech"
                  ? (
                    <input
                      aria-label="Tech level"
                      type="number"
                      min={6}
                      max={28}
                      value={draft.techLevel}
                      ref={techInput}
                      onBlur={() =>
                        setEditing((current) =>
                          current === "tech" ? null : current
                        )}
                      onChange={(event) =>
                        setTechLevel(Number(event.currentTarget.value))}
                    />
                  )
                  : <span>{draft.techLevel}</span>}
                <Pencil label="tech level" onEdit={() => setEditing("tech")} />
              </span>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={draft.standardDesign}
                onChange={(event) =>
                  patch({ standardDesign: event.currentTarget.checked })}
              />
              Standard Design
            </label>
          </div>
          <div className="design-description">
            <div className="description-head">
              <button
                type="button"
                className="description-toggle"
                aria-expanded={descriptionOpen}
                onClick={() => setDescriptionOpen((open) => !open)}
              >
                Description
              </button>
              <Pencil label="description" onEdit={editDescription} />
            </div>
            {descriptionOpen
              ? (
                <textarea
                  ref={descriptionRef}
                  value={draft.description}
                  onChange={(event) =>
                    patch({ description: event.currentTarget.value })}
                />
              )
              : null}
          </div>
          <HullSection draft={draft} catalog={catalog} onChange={patch} />
          <DrivesSection draft={draft} sheet={sheet} onChange={patch} />
          <BridgeSection draft={draft} sheet={sheet} onChange={patch} />
          <WeaponsSection draft={draft} sheet={sheet} onChange={patch} />
          <AccommodationsSection draft={draft} onChange={patch} />
          <DocksSection
            draft={draft}
            catalog={catalog}
            sheet={sheet}
            onChange={patch}
          />
        </section>
      </div>
      <div className="design-sheets">
        <DesignSheets design={draft} catalog={catalog} sheet={sheet} />
      </div>
    </div>
  );
}

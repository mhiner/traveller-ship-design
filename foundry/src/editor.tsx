import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { armourAt } from "../../src/catalog/hull.ts";
import { powerPlantsAt } from "../../src/catalog/drives.ts";
import { type AdvancedDesign, evaluateDesign } from "../../src/design.ts";
import { SHIP_CLASSIFICATIONS } from "../../src/classification.ts";
import { designBundleFromJson, designForExport } from "../../src/store.ts";
import { freshId } from "../../src/ui/design/shared.tsx";
import { AccommodationsSection } from "../../src/ui/design/AccommodationsSection.tsx";
import { BridgeSection } from "../../src/ui/design/BridgeSection.tsx";
import { DesignSheets } from "../../src/ui/design/DesignSheets.tsx";
import { DocksSection } from "../../src/ui/design/DocksSection.tsx";
import { DrivesSection } from "../../src/ui/design/DrivesSection.tsx";
import { HullSection } from "../../src/ui/design/HullSection.tsx";
import { WeaponsSection } from "../../src/ui/design/WeaponsSection.tsx";

/** Imperative handle the host uses to replace or read the open design. */
export interface ShipEditorApi {
  /** Stores a design the host already holds. */
  replace(design: AdvancedDesign, modules: AdvancedDesign[]): void;
  /** The design and module library currently open in the form. */
  draft(): { design: AdvancedDesign; modules: AdvancedDesign[] };
}

interface Props {
  design: AdvancedDesign;
  modules: AdvancedDesign[];
  onChange(design: AdvancedDesign, modules: AdvancedDesign[]): void;
  onReady(api: ShipEditorApi): void;
}

/** Download name for a design. A blank name becomes ship.json. */
function designJsonFilename(name: string): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(
    /^-|-$/g,
    ""
  );
  return `${slug || "ship"}.json`;
}

type TitleKey = "name" | "classification" | "tech";

/** Keeps the current id when this tech level still allows it. Otherwise the last remaining catalog row is used. */
function keepOrLast<Id extends string>(
  rows: readonly { id: Id }[],
  current: Id
): Id {
  return rows.some((row) => row.id === current)
    ? current
    : rows[rows.length - 1]?.id ?? current;
}

/** Downloads the design as JSON and returns the name shown in the status line. */
function exportDesignFile(
  draft: AdvancedDesign,
  catalog: readonly AdvancedDesign[]
): string {
  const name = draft.name.trim() || "ship";
  const blob = new Blob([
    JSON.stringify(designForExport(draft, catalog), null, 2)
  ], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = designJsonFilename(name);
  document.body.append(link);
  link.click();
  link.remove();
  // The object URL has to outlive the click, then it can be released.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}

/** Reads a design bundle from a JSON file. A rejected bundle yields null. A design with a blank id receives a fresh one. */
async function readDesignFile(
  chosen: File
): Promise<{ design: AdvancedDesign; modules: AdvancedDesign[] } | null> {
  const parsed = designBundleFromJson(JSON.parse(await chosen.text()));
  if (!parsed) return null;
  const design = { ...parsed.design, id: parsed.design.id || freshId() };
  return {
    design,
    modules: parsed.bundled.filter((row) => row.id !== design.id)
  };
}

/** Pencil button that opens a field for editing. The mousedown keeps focus on the field this button opens. */
function Pencil({ label, onEdit }: { label: string; onEdit: () => void }) {
  return (
    <button
      type="button"
      className="edit-field"
      aria-label={`Edit ${label}`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onEdit}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
        />
      </svg>
    </button>
  );
}

/** A title that shows its text until editing, then shows the input passed as children. */
function TitleField({
  tag: Tag = "span",
  className,
  label,
  pencil,
  editing,
  onEdit,
  display,
  children
}: {
  tag?: "h2" | "span";
  className?: string;
  label?: string;
  pencil: string;
  editing: boolean;
  onEdit: () => void;
  display: string;
  children: ComponentChildren;
}) {
  return (
    <Tag className={className}>
      {label ? <span className="ship-title-label">{label}</span> : null}
      {editing ? children : <span>{display}</span>}
      <Pencil label={pencil} onEdit={onEdit} />
    </Tag>
  );
}

/** One ship. Import and export are the only design actions. */
export function ShipEditor(
  { design, modules, onChange, onReady }: Props
) {
  const [draft, setDraft] = useState(design);
  const [library, setLibrary] = useState(modules);
  const [message, setMessage] = useState("");
  const [messageBad, setMessageBad] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<TitleKey | null>(null);
  const draftRef = useRef(draft);
  const libraryRef = useRef(library);
  const nameInput = useRef<HTMLInputElement>(null);
  const classificationInput = useRef<HTMLSelectElement>(null);
  const techInput = useRef<HTMLInputElement>(null);
  const titleRefs = { name: nameInput, classification: classificationInput, tech: techInput };
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const focusDescription = useRef(false);

  /** Writes the draft and reports it to the host. */
  const commit = (
    next: AdvancedDesign,
    nextModules: AdvancedDesign[] = libraryRef.current
  ) => {
    draftRef.current = next;
    libraryRef.current = nextModules;
    setDraft(next);
    setLibrary(nextModules);
    onChange(next, nextModules);
  };

  /** Stores a design the host pushed in. Sync stays with that host. */
  const replace = (next: AdvancedDesign, nextModules: AdvancedDesign[]) => {
    draftRef.current = next;
    libraryRef.current = nextModules;
    setDraft(next);
    setLibrary(nextModules);
  };

  useEffect(() => {
    // Register the imperative API once. Later reads go through the refs.
    onReady({
      replace,
      draft: () => ({
        design: draftRef.current,
        modules: libraryRef.current
      })
    });
  }, []);

  useEffect(() => {
    // Focus the title field that just opened.
    if (editing) titleRefs[editing].current?.focus();
  }, [editing]);

  useEffect(() => {
    // Wait until the textarea is mounted, then focus it once.
    if (!descriptionOpen || !focusDescription.current) return;
    focusDescription.current = false;
    descriptionRef.current?.focus();
  }, [descriptionOpen]);

  /** Status line under the file buttons. A bad note is shown as an error. */
  const note = (text: string, bad = false) => {
    setMessage(text);
    setMessageBad(bad);
  };

  /** Merges a partial design into the draft and clears the status line. */
  const update = (partial: Partial<AdvancedDesign>) => {
    commit({ ...draftRef.current, ...partial });
    note("");
  };

  /** Closes a title field when that field blurs, and leaves a different field open. */
  const stopEditing = (key: TitleKey) => () => {
    setEditing((current) => current === key ? null : current);
  };

  /** Sets tech level and keeps the power plant and armour legal at that level. */
  const setTechLevel = (techLevel: number) => {
    const current = draftRef.current;
    update({
      techLevel,
      powerPlant: keepOrLast(powerPlantsAt(techLevel), current.powerPlant),
      armour: keepOrLast(armourAt(techLevel), current.armour)
    });
  };

  // The open design leads the catalog, then the other saved designs.
  const catalog = [
    draft,
    ...library.filter((row) => row.id !== draft.id)
  ];
  const sheet = evaluateDesign(draft, catalog);

  /** Downloads the open design and reports the file name. */
  const exportDesign = () => {
    note(`Exported ${exportDesignFile(draft, catalog)}.`);
  };

  /** Loads a design file into the editor. The input is cleared so the same file can be chosen again. */
  const importDesign = async (
    chosen: File | undefined,
    input: HTMLInputElement
  ) => {
    if (!chosen) return;
    try {
      const imported = await readDesignFile(chosen);
      if (!imported) {
        note("That file is not a ship design.", true);
        return;
      }
      commit(imported.design, imported.modules);
      note(`Imported ${imported.design.name}.`);
    } catch {
      note("Could not read that file.", true);
    } finally {
      input.value = "";
    }
  };

  /** Opens the description and moves focus to it. */
  const editDescription = () => {
    focusDescription.current = true;
    if (descriptionOpen) descriptionRef.current?.focus();
    else setDescriptionOpen(true);
  };

  return (
    <>
    <div className={sheetOpen ? "split sheet-open" : "split sheet-closed"}>
      <div>
        <section className="panel design-form">
          <div className="ship-title">
            <div className="ship-heading">
              <TitleField
                tag="h2"
                pencil="name"
                editing={editing === "name"}
                onEdit={() => setEditing("name")}
                display={draft.name.trim() || "Design"}
              >
                <input
                  aria-label="Name"
                  value={draft.name}
                  ref={nameInput}
                  onBlur={stopEditing("name")}
                  onChange={(event) =>
                    update({ name: event.currentTarget.value })}
                />
              </TitleField>
              <TitleField
                className="ship-title-field"
                label="Classification"
                pencil="classification"
                editing={editing === "classification"}
                onEdit={() => setEditing("classification")}
                display={draft.classification}
              >
                <select
                  aria-label="Classification"
                  value={draft.classification}
                  ref={classificationInput}
                  onBlur={stopEditing("classification")}
                  onChange={(event) =>
                    update({
                      classification: event.currentTarget
                        .value as AdvancedDesign["classification"]
                    })}
                >
                  {SHIP_CLASSIFICATIONS.map((classification) => (
                    <option key={classification} value={classification}>
                      {classification}
                    </option>
                  ))}
                </select>
              </TitleField>
              <TitleField
                className="ship-title-field"
                label="TL"
                pencil="tech level"
                editing={editing === "tech"}
                onEdit={() => setEditing("tech")}
                display={String(draft.techLevel)}
              >
                <input
                  aria-label="Tech level"
                  type="number"
                  min={6}
                  max={28}
                  value={draft.techLevel}
                  ref={techInput}
                  onBlur={stopEditing("tech")}
                  onChange={(event) =>
                    setTechLevel(Number(event.currentTarget.value))}
                />
              </TitleField>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={draft.standardDesign}
                onChange={(event) =>
                  update({ standardDesign: event.currentTarget.checked })}
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
                    update({ description: event.currentTarget.value })}
                />
              )
              : null}
          </div>
          <HullSection draft={draft} catalog={catalog} onChange={update} />
          <DrivesSection draft={draft} sheet={sheet} onChange={update} />
          <BridgeSection draft={draft} sheet={sheet} onChange={update} />
          <WeaponsSection draft={draft} sheet={sheet} onChange={update} />
          <AccommodationsSection draft={draft} onChange={update} />
          <DocksSection
            draft={draft}
            catalog={catalog}
            sheet={sheet}
            onChange={update}
          />
        </section>
      </div>
      <div className="design-sheets">
        <button
          type="button"
          className="sheet-collapse"
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen((open) => !open)}
        >
          {sheetOpen ? "Hide sheet" : "Ship sheet"}
        </button>
        {sheetOpen
          ? <DesignSheets design={draft} catalog={catalog} sheet={sheet} />
          : null}
      </div>
    </div>
    <section className="panel">
      <div className="row design-actions ship-file-actions">
        <button type="button" onClick={exportDesign}>Export</button>
        <label className="file-button">
          Import
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) =>
              void importDesign(
                event.currentTarget.files?.[0],
                event.currentTarget
              )}
          />
        </label>
      </div>
      {message
        ? <p className={messageBad ? "error" : "meta"}>{message}</p>
        : null}
    </section>
    </>
  );
}

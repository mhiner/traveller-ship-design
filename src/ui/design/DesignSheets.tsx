import { useEffect, useState } from "../../runtime.ts";
import { combinedBreakaway, nameBreakawayHulls } from "../../combined.ts";
import {
  type AdvancedDesign,
  type DesignSheet,
  evaluateDesign,
} from "../../design.ts";
import {
  exteriorAppearsUnarmed,
  hasAdjustableHull,
} from "../../catalog/weapons.ts";
import { money, sheetCost, suppliedPower, tonLabel } from "./shared.tsx";
import { biosphereNote, layoutSheet, type SheetFold } from "./sheetLayout.ts";

function DesignSheetView(
  {
    design,
    sheet,
    heading = true,
    titleExtra = null,
    chooser = null,
    unavailable = false,
  }: {
    design: AdvancedDesign;
    sheet: DesignSheet;
    heading?: boolean;
    // deno-lint-ignore no-explicit-any
    titleExtra?: any;
    // deno-lint-ignore no-explicit-any
    chooser?: any;
    unavailable?: boolean;
  },
) {
  const [softwareOpen, setSoftwareOpen] = useState(false);
  const [hullOpen, setHullOpen] = useState(false);
  const [brainOpen, setBrainOpen] = useState(false);
  const [openDocks, setOpenDocks] = useState<ReadonlySet<number>>(() =>
    new Set()
  );
  const [openTurrets, setOpenTurrets] = useState<ReadonlySet<number>>(() =>
    new Set()
  );
  const [openRobotics, setOpenRobotics] = useState<ReadonlySet<number>>(() =>
    new Set()
  );
  const title = design.name.trim() || "Design";
  const rows = layoutSheet(design, sheet, {
    softwareOpen,
    hullOpen,
    brainOpen,
    openDocks,
    openTurrets,
    openRobotics,
    heading,
  });
  const toggle = (fold: SheetFold, index: number) => {
    if (fold === "software") setSoftwareOpen((open) => !open);
    else if (fold === "hull") setHullOpen((open) => !open);
    else if (fold === "brain") setBrainOpen((open) => !open);
    else if (fold === "dock") {
      setOpenDocks((open) => {
        const next = new Set(open);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
      });
    } else if (fold === "turret") {
      setOpenTurrets((open) => {
        const next = new Set(open);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
      });
    } else {setOpenRobotics((open) => {
        const next = new Set(open);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        return next;
      });}
  };
  const openFold = (fold: SheetFold, index: number) => {
    if (fold === "software") setSoftwareOpen(true);
    else if (fold === "hull") setHullOpen(true);
    else if (fold === "brain") setBrainOpen(true);
    else if (fold === "turret") {
      setOpenTurrets((open) => {
        const next = new Set(open);
        next.add(index);
        return next;
      });
    } else if (fold === "robotics") {
      setOpenRobotics((open) => {
        const next = new Set(open);
        next.add(index);
        return next;
      });
    }
  };
  const passengers = biosphereNote(sheet.lines);
  const body = (
    <div className="design-sheet-body">
      <p className="meta">
        Usable {tonLabel(sheet.usable)} · Fitted {tonLabel(sheet.used)} · Cargo
        {" "}
        {tonLabel(sheet.cargo)} · {money(sheet.cost)}
      </p>
      {exteriorAppearsUnarmed(
          design.mounts,
          design.hullTons,
          hasAdjustableHull(design.hullOptions),
        )
        ? (
          <p className="meta">
            An exterior sensor scan treats this ship as unarmed.
          </p>
        )
        : null}
      {heading
        ? sheet.errors.map((error) => (
          <p key={error} className="error">{error}</p>
        ))
        : null}
      {heading
        ? sheet.warnings.map((warning) => (
          <p key={warning} className="warning">{warning}</p>
        ))
        : null}
      <div className="sheet-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Component</th>
              <th>Tons</th>
              <th>Power</th>
              {heading ? <th>Cost</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                className={row.className}
                onClick={row.fold
                  ? () => toggle(row.fold as SheetFold, row.index)
                  : undefined}
              >
                <td>
                  {row.label}
                  {row.note
                    ? <small className="custom-note">({row.note})</small>
                    : null}
                  {row.fold && row.foldLabel
                    ? (
                      <span
                        className="sheet-fold"
                        onClick={(event) => {
                          event.stopPropagation();
                          openFold(row.fold as SheetFold, row.index);
                        }}
                      >
                        {row.foldLabel}
                      </span>
                    )
                    : null}
                </td>
                <td>{tonLabel(row.tons)}</td>
                <td>{row.power == null ? "—" : row.power}</td>
                {heading
                  ? <td>{row.cost ? sheetCost(row.cost) : "—"}</td>
                  : null}
              </tr>
            ))}
            <tr>
              <td>Cargo</td>
              <td>{tonLabel(sheet.cargo)}</td>
              <td>—</td>
              {heading ? <td>—</td> : null}
            </tr>
            <tr className="total">
              <td>Total</td>
              <td>{tonLabel(sheet.lines[0]?.tons ?? design.hullTons)}</td>
              <td>{sheet.powerUse.total}/{suppliedPower(design, sheet)}</td>
              {heading ? <td>{sheetCost(sheet.cost)}</td> : null}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="meta">
        {sheet.crew.map((row) => `${row.role} ${row.count}`).join(" · ")}
      </p>
      {passengers ? <p className="meta">{passengers}</p> : null}
    </div>
  );
  const shown = unavailable
    ? <p className="error">That design is no longer available.</p>
    : body;
  const headingRow = (
    <div className="sheet-heading">
      <h2>{unavailable ? "Missing design" : title}</h2>
      {titleExtra}
      {unavailable ? null : (
        <p className="sheet-hull-points">
          Hull {sheet.hullPoints} · Armour {sheet.armourRating}
        </p>
      )}
    </div>
  );
  const showHeading = heading || titleExtra || chooser || !unavailable;
  return (
    <div
      className={heading
        ? "panel design-sheet"
        : "panel design-sheet sheet-fill"}
    >
      {showHeading || chooser
        ? (
          <div className="sheet-pin">
            {showHeading ? headingRow : null}
            {chooser}
          </div>
        )
        : null}
      {shown}
    </div>
  );
}

interface SheetChoice {
  id: string;
  label: string;
  design: AdvancedDesign;
  sheet: DesignSheet;
  unavailable?: boolean;
}

function hullSheetLabel(
  name: string,
  tons: number,
  duplicate: boolean,
): string {
  const label = name.trim() || "Design";
  return duplicate ? `${label} · ${tons} t` : label;
}

export function DesignSheets(
  { design, catalog, heading = true, sheet: supplied }: {
    design: AdvancedDesign;
    catalog: readonly AdvancedDesign[];
    heading?: boolean;
    /** Sheet for the open design. Other hulls are still evaluated here. */
    sheet?: DesignSheet;
  },
) {
  const moduleDraft = design.hullType === "module";
  const sheet = supplied ?? evaluateDesign(design, catalog);
  const known = new Map<string, DesignSheet>();
  const sheetFor = (hull: AdvancedDesign): DesignSheet => {
    if (hull === design) return sheet;
    const cached = known.get(hull.id);
    if (cached) return cached;
    const next = evaluateDesign(hull, catalog);
    known.set(hull.id, next);
    return next;
  };
  const breakaway = !moduleDraft &&
    design.hullOptions.some((option) => option.kind === "breakaway");
  const joined = breakaway ? (design.breakawayHulls ?? []) : [];
  const hulls = joined.flatMap((id) => {
    const found = catalog.find((row) => row.id === id);
    return found ? [found] : [];
  });
  const combined = hulls.length > 0
    ? combinedBreakaway([design, ...hulls], catalog, [
      sheet,
      ...hulls.map((hull) => sheetFor(hull)),
    ])
    : null;
  const namedSheet = (hullSheet: DesignSheet, ids: readonly string[]) =>
    nameBreakawayHulls(hullSheet, ids, catalog);
  const primarySheet = namedSheet(sheet, joined);
  const uniqueIds: string[] = [];
  const seenIds = new Set<string>();
  for (const id of joined) {
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    uniqueIds.push(id);
  }
  const uniqueHulls = uniqueIds.flatMap((id) => {
    const found = catalog.find((row) => row.id === id);
    return found ? [found] : [];
  });
  const names = new Map<string, number>();
  for (const hull of [design, ...uniqueHulls]) {
    names.set(hull.name, (names.get(hull.name) ?? 0) + 1);
  }
  const choices: SheetChoice[] = joined.length > 0
    ? [
      {
        id: `hull:${design.id}`,
        label: hullSheetLabel(
          design.name,
          design.hullTons,
          (names.get(design.name) ?? 0) > 1,
        ),
        design,
        sheet: primarySheet,
      },
      ...uniqueIds.map((id) => {
        const found = catalog.find((row) => row.id === id);
        if (!found) {
          return {
            id: `hull:${id}`,
            label: "Missing design",
            design,
            sheet: primarySheet,
            unavailable: true,
          };
        }
        return {
          id: `hull:${found.id}`,
          label: hullSheetLabel(
            found.name,
            found.hullTons,
            (names.get(found.name) ?? 0) > 1,
          ),
          design: found,
          sheet: namedSheet(sheetFor(found), found.breakawayHulls ?? []),
        };
      }),
      ...(combined
        ? [{
          id: "combined",
          label: combined.design.name,
          design: combined.design,
          sheet: namedSheet(combined.sheet, joined),
        }]
        : []),
    ]
    : [];
  const choiceKey = choices.map((choice) => choice.id).join("|");
  const [viewId, setViewId] = useState(choices[0]?.id ?? "");
  const [choosing, setChoosing] = useState(false);
  useEffect(() => {
    if (choices.length === 0) return;
    if (!choices.some((choice) => choice.id === viewId)) {
      setViewId(choices[0].id);
    }
  }, [choiceKey]);
  const selected = choices.find((choice) => choice.id === viewId) ?? choices[0];
  const stop = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  return (
    <DesignSheetView
      key={selected?.id ?? "sheet"}
      design={selected?.design ?? design}
      sheet={selected?.sheet ?? primarySheet}
      heading={heading}
      unavailable={selected?.unavailable === true}
      titleExtra={choices.length > 0
        ? (
          <button
            type="button"
            className="sheet-view-link"
            onClick={(event) => {
              stop(event);
              setChoosing((open) => !open);
            }}
          >
            (change view)
          </button>
        )
        : null}
      chooser={choosing && choices.length > 0
        ? (
          <div className="sheet-views">
            {choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                aria-current={choice.id === selected?.id ? "true" : undefined}
                onClick={() => {
                  setViewId(choice.id);
                  setChoosing(false);
                }}
              >
                {choice.label}
              </button>
            ))}
          </div>
        )
        : null}
    />
  );
}

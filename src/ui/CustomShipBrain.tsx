import { useState } from "../runtime.ts";
import {
  armourLimits,
  blankCustomShipBrain,
  BRAIN_OPTIONS,
  BRAIN_PROGRAMS,
  BRAIN_SKILLS,
  BRAIN_UPGRADES,
  type BrainSkillFit,
  characteristicDm,
  chassisBaseSlots,
  compareSkillFits,
  type CustomShipBrain as CustomBrain,
  includedBrainOption,
  optionsAt,
  programCost,
  programsAt,
  quoteCustomShipBrain,
  skillBandwidth,
  skillCredits,
  skillsAt,
  upgradesAt,
} from "../shipBrain.ts";
import { skillSpecialties, specialtyLabel } from "../skills.ts";
import { credits } from "./format.ts";
import { NumberField, TextField } from "./fields.tsx";

export function CustomShipBrainPanel(
  { brain, techLevel, haptics = false, onChange }: {
    brain: CustomBrain | undefined;
    techLevel: number;
    haptics?: boolean;
    onChange: (brain: CustomBrain) => void;
  },
) {
  const spec = brain ?? blankCustomShipBrain(techLevel);
  const quote = quoteCustomShipBrain(spec, techLevel, haptics);
  const armour = armourLimits(techLevel);
  const baseSlots = chassisBaseSlots(spec.chassis);
  const [optionPick, setOptionPick] = useState("");
  const [skillPick, setSkillPick] = useState("");
  const [skillLevel, setSkillLevel] = useState(0);
  const [skillSpecialty, setSkillSpecialty] = useState("");

  const program = BRAIN_PROGRAMS.find((row) => row.id === spec.programming);
  const programs = programsAt(techLevel);
  const programChoices =
    program && !programs.some((row) => row.id === program.id)
      ? [program, ...programs]
      : programs;
  const upgrades = program ? upgradesAt(techLevel, program.rank) : [];
  const upgradeChoices = BRAIN_UPGRADES.filter((row) =>
    row.id === spec.bandwidthUpgrade &&
    !upgrades.some((upgrade) => upgrade.id === row.id)
  );
  const availableOptions = optionsAt(techLevel).filter((option) =>
    !spec.options.includes(option.id)
  );
  const optionChoice =
    availableOptions.some((option) => option.id === optionPick)
      ? optionPick
      : availableOptions[0]?.id ?? "";
  const availableSkills = skillsAt(techLevel);
  const skillChoice = availableSkills.some((skill) => skill.id === skillPick)
    ? skillPick
    : availableSkills[0]?.id ?? "";
  const chosenSkill = availableSkills.find((skill) => skill.id === skillChoice);
  const levelCap = chosenSkill && program
    ? Math.min(
      3,
      Math.max(0, techLevel - chosenSkill.tl),
      Math.max(0, program.bandwidth - chosenSkill.bandwidth),
    )
    : 0;
  const addLevel = Math.min(skillLevel, levelCap);
  const addSpecialties = chosenSkill && addLevel > 0
    ? skillSpecialties(chosenSkill.label)
    : [];
  const addSpecialty = addSpecialties.find((item) => item === skillSpecialty) ??
    addSpecialties[0] ?? "";
  const total = quote.lines.reduce((sum, line) => sum + line.cost, 0);

  const update = (next: Partial<CustomBrain>) => onChange({ ...spec, ...next });
  const modifier = (value: number) =>
    value > 0 ? `+${value}` : value === 0 ? "+0" : String(value);
  const skillModifier = (characteristic: "int" | "dex" | "str") => {
    if (characteristic === "dex" && quote.dexterity !== undefined) {
      return `DEX ${quote.dexterity} DM ${modifier(quote.dexDm)}`;
    }
    const dm = characteristic === "int"
      ? characteristicDm(quote.intellect)
      : characteristic === "dex"
      ? quote.dexDm
      : characteristicDm(0);
    return `${characteristic.toUpperCase()} DM ${modifier(dm)}`;
  };

  return (
    <details className="panel custom-brain">
      <summary>
        {spec.name.trim() || "Custom ship's brain"}{" "}
        ({credits(Math.round(total * 1_000_000))})
      </summary>
      <p className="meta">
        No locomotion and no manipulators. The default suite — visual, auditory,
        voder, wireless, a 5km transceiver, and external power — is included.
        Tech level {techLevel}. Protection {quote.protection}. INT{" "}
        {quote.intellect} (DM {modifier(quote.skillDm)}).{" "}
        {quote.dexterity === undefined
          ? `DEX DM ${modifier(quote.dexDm)}`
          : `DEX ${quote.dexterity} (DM ${modifier(quote.dexDm)})`}. Bandwidth
        {" "}
        {quote.bandwidthUsed}/{quote.bandwidthAvailable}. Slots{" "}
        {quote.slotsUsed}/{quote.slotsAvailable}.
      </p>
      {quote.builtIn
        ? <p className="meta">Built in: {quote.builtIn}.</p>
        : null}
      {quote.errors.map((error) => <p key={error} className="error">{error}
      </p>)}
      {quote.warnings.map((warning) => (
        <p key={warning} className="warning">{warning}</p>
      ))}
      <div className="grid">
        <TextField
          label="Name"
          value={spec.name}
          onChange={(name) => update({ name })}
        />
        <NumberField
          label="Chassis size"
          value={spec.chassis}
          min={1}
          max={6}
          onChange={(chassis) => update({
            chassis: Math.min(6, Math.max(1, Math.trunc(chassis) || 1)),
          })}
        />
        <NumberField
          label={`Armour (+${armour.base} base)`}
          value={spec.armour}
          min={0}
          max={armour.max}
          onChange={(armourPoints) =>
            update({ armour: Math.max(0, Math.trunc(armourPoints) || 0) })}
        />
        <label>
          Programming
          <select
            value={spec.programming}
            onChange={(event) =>
              update({
                programming: event.currentTarget.value,
                bandwidthUpgrade: "",
              })}
          >
            {programChoices.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label} TL{row.tl} · INT {row.int} · Bandwidth{" "}
                {row.bandwidth} · {credits(programCost(row, techLevel))}
              </option>
            ))}
          </select>
        </label>
        <label>
          Bandwidth upgrade
          <select
            value={spec.bandwidthUpgrade}
            onChange={(event) =>
              update({ bandwidthUpgrade: event.currentTarget.value })}
          >
            <option value="">None</option>
            {[...upgradeChoices, ...upgrades].map((row) => (
              <option key={row.id} value={row.id}>
                {row.label} · {credits(row.credits)} · 1 slot
              </option>
            ))}
          </select>
        </label>
        <NumberField
          label="Intellect upgrade"
          value={spec.intellect}
          min={0}
          max={3}
          onChange={(intellect) =>
            update({
              intellect: Math.min(3, Math.max(0, Math.trunc(intellect) || 0)),
            })}
        />
        <label>
          Brain hardening
          <select
            value={spec.hardened ? "yes" : "no"}
            onChange={(event) =>
              update({ hardened: event.currentTarget.value === "yes" })}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </label>
      </div>

      <h3>Options</h3>
      <NumberField
        label="Ava Ship's Avatar"
        note="Cr100,000 each, no tonnage or power"
        value={spec.avatars}
        min={0}
        step={1}
        onChange={(avatars) =>
          update({ avatars: Math.max(0, Math.trunc(avatars) || 0) })}
      />
      <table>
        <thead>
          <tr>
            <th>Option</th>
            <th>Cost</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {[...spec.options].filter((id) => !includedBrainOption(id)).sort(
            (left, right) => {
              const leftLabel =
                BRAIN_OPTIONS.find((row) => row.id === left)?.label ?? left;
              const rightLabel =
                BRAIN_OPTIONS.find((row) => row.id === right)?.label ?? right;
              return leftLabel.localeCompare(rightLabel);
            },
          ).map((id) => {
            const option = BRAIN_OPTIONS.find((row) => row.id === id);
            if (!option) return null;
            const amount = option.cost.kind === "flat"
              ? option.cost.credits
              : option.cost.credits * baseSlots;
            return (
              <tr key={id}>
                <td>{option.label}</td>
                <td>{credits(amount)}</td>
                <td>
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        options: spec.options.filter((item) => item !== id),
                      })}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="row">
        <select
          aria-label="Add brain option"
          value={optionChoice}
          disabled={availableOptions.length === 0}
          onChange={(event) => setOptionPick(event.currentTarget.value)}
        >
          {availableOptions.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!optionChoice}
          onClick={() => update({ options: [...spec.options, optionChoice] })}
        >
          Add
        </button>
      </div>

      <h3>Skill software</h3>
      <table>
        <thead>
          <tr>
            <th>Skill</th>
            <th>Specialty</th>
            <th>Level</th>
            <th>Bandwidth</th>
            <th>Effective</th>
            <th>Cost</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {[...spec.skills].sort(compareSkillFits).map((fit) => {
            const skill = BRAIN_SKILLS.find((row) => row.id === fit.skill);
            const quoted = quote.skills.find((row) => row.id === fit.id);
            if (!skill || !quoted) return null;
            const specialties = fit.level > 0
              ? skillSpecialties(skill.label)
              : [];
            return (
              <tr key={fit.id}>
                <td>{skill.label}</td>
                <td>
                  {specialties.length > 0
                    ? (
                      <select
                        aria-label={`${skill.label} specialty`}
                        value={specialties.includes(fit.specialty)
                          ? fit.specialty
                          : ""}
                        onChange={(event) =>
                          update({
                            skills: spec.skills.map((row) =>
                              row.id === fit.id
                                ? {
                                  ...row,
                                  specialty: event.currentTarget.value,
                                }
                                : row
                            ),
                          })}
                      >
                        <option value="">Choose</option>
                        {specialties.map((item) => (
                          <option key={item} value={item}>
                            {specialtyLabel(skill.label, item)}
                          </option>
                        ))}
                      </select>
                    )
                    : "—"}
                </td>
                <td>
                  <input
                    aria-label={`${skill.label} level`}
                    type="number"
                    min={0}
                    max={3}
                    value={fit.level}
                    onChange={(event) => {
                      const level = Math.min(
                        3,
                        Math.max(
                          0,
                          Math.trunc(Number(event.currentTarget.value)) || 0,
                        ),
                      );
                      const nextSpecialties = level > 0
                        ? skillSpecialties(skill.label)
                        : [];
                      const specialty = nextSpecialties.includes(fit.specialty)
                        ? fit.specialty
                        : nextSpecialties[0] ?? "";
                      const skills: BrainSkillFit[] = spec.skills.map((row) =>
                        row.id === fit.id ? { ...row, level, specialty } : row
                      );
                      update({ skills });
                    }}
                  />
                </td>
                <td>{quoted.bandwidth}</td>
                <td>
                  {quoted.effective}{" "}
                  <small className="custom-note">
                    ({skillModifier(skill.characteristic)})
                  </small>
                </td>
                <td>{credits(quoted.credits)}</td>
                <td>
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        skills: spec.skills.filter((row) => row.id !== fit.id),
                      })}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="row">
        <select
          aria-label="Add skill software"
          value={skillChoice}
          disabled={availableSkills.length === 0}
          onChange={(event) => setSkillPick(event.currentTarget.value)}
        >
          {availableSkills.map((skill) => (
            <option key={skill.id} value={skill.id}>{skill.label}</option>
          ))}
        </select>
        {addSpecialties.length > 0
          ? (
            <label>
              Specialty
              <select
                aria-label="Skill specialty"
                value={addSpecialty}
                onChange={(event) =>
                  setSkillSpecialty(event.currentTarget.value)}
              >
                {addSpecialties.map((item) => (
                  <option key={item} value={item}>
                    {chosenSkill
                      ? specialtyLabel(chosenSkill.label, item)
                      : item}
                  </option>
                ))}
              </select>
            </label>
          )
          : null}
        <label>
          Level
          <input
            aria-label="Skill level"
            type="number"
            min={0}
            max={levelCap}
            value={addLevel}
            onChange={(event) => setSkillLevel(
              Math.max(0, Math.trunc(Number(event.currentTarget.value)) || 0),
            )}
          />
        </label>
        <button
          type="button"
          disabled={!chosenSkill ||
            (addLevel > 0 && addSpecialties.length > 0 && !addSpecialty)}
          onClick={() => {
            if (!chosenSkill) return;
            update({
              skills: [...spec.skills, {
                id: crypto.randomUUID(),
                skill: chosenSkill.id,
                level: addLevel,
                specialty: addLevel > 0 ? addSpecialty : "",
              }],
            });
          }}
        >
          Add {chosenSkill
            ? `${credits(skillCredits(chosenSkill, addLevel))} · bandwidth ${
              program ? skillBandwidth(chosenSkill, addLevel) : 0
            }`
            : ""}
        </button>
      </div>
    </details>
  );
}

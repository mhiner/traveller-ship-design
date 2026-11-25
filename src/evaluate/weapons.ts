import type { AdvancedDesign, DesignLine } from "../design.ts";
import {
  hasAdjustableHull,
  MOUNT_KINDS,
  mountLineName,
  type MountWeaponId,
  mountWeaponSlots,
  pointsUsed,
  POPUP_MOUNT,
  weaponChoices,
  type WeaponMount,
  weaponPoints,
  weaponPowerPoints,
  weaponsForMount,
} from "../catalog/weapons.ts";
import { customAdjustment } from "../catalog/drives.ts";
import { countedName, findById, round2, sheetLine } from "./shared.ts";

function pricedWeapon(
  mount: WeaponMount,
  index: number,
  id: MountWeaponId,
  hullTons: number,
) {
  const item = weaponsForMount(mount.kind).find((row) => row.id === id);
  if (!item) return null;
  const fit = customAdjustment(
    weaponChoices(item.id, mount.kind),
    mount.custom?.[index],
  );
  const power = Math.round(
    weaponPowerPoints(item.power, hullTons) * fit.powerFactor,
  );
  return {
    item,
    fit,
    power,
    cost: fit.costFactor === 1 ? item.cost : round2(item.cost * fit.costFactor),
  };
}

export interface WeaponsSection {
  lines: DesignLine[];
  errors: string[];
  weaponPower: number;
  usedPoints: number;
}

export function buildWeapons(
  design: AdvancedDesign,
  hullTons: number,
  moduleHull: boolean,
  techLevel: number,
): WeaponsSection {
  const errors: string[] = [];
  const lines: DesignLine[] = [];
  const mounts = design.mounts ?? [];
  const adjustable = !moduleHull && hasAdjustableHull(design.hullOptions);
  const points = weaponPoints(hullTons);
  let weaponPower = 0;
  let singleTurrets = 0;
  for (const mount of mounts) {
    const kind = findById(MOUNT_KINDS, mount.kind, MOUNT_KINDS[0]);
    if (
      hullTons < 100 && kind.id !== "single" && kind.id !== "fixed" &&
      kind.id !== "barbette"
    ) errors.push(`${kind.label} requires a hull of at least 100 tons.`);
    if (kind.id === "single") singleTurrets += 1;
    if (kind.tl > 0 && techLevel < kind.tl) {
      errors.push(`${kind.label} requires tech level ${kind.tl}.`);
    }
    const popup = mount.popup === true && kind.id !== "barbette" && !adjustable;
    if (
      popup && techLevel < POPUP_MOUNT.tl &&
      !errors.includes(`Pop-up mounting requires tech level ${POPUP_MOUNT.tl}.`)
    ) {
      errors.push(`Pop-up mounting requires tech level ${POPUP_MOUNT.tl}.`);
    }
    weaponPower += kind.power;
    const slots = mountWeaponSlots(kind.id, hullTons);
    const fitted = (mount.weapons ?? []).slice(0, slots);
    if ((mount.weapons ?? []).length > slots) {
      errors.push(`${kind.label} holds ${slots} weapons.`);
    }
    fitted.forEach((id, index) => {
      const priced = pricedWeapon(mount, index, id, hullTons);
      if (!priced) return;
      if (techLevel < priced.item.tl + priced.fit.tl) {
        errors.push(
          `${priced.item.label} requires tech level ${
            priced.item.tl + priced.fit.tl
          }.`,
        );
      }
      weaponPower += priced.power;
    });
  }
  const usedPoints = pointsUsed(mounts, hullTons);
  if (hullTons < 100 && singleTurrets > 1) {
    errors.push("A hull under 100 tons can mount one single turret.");
  }
  if (usedPoints > points.count) {
    errors.push(
      `The hull has ${points.count} ${points.label.toLowerCase()} and the design uses ${usedPoints}.`,
    );
  }

  for (const mount of mounts) {
    const kind = findById(MOUNT_KINDS, mount.kind, MOUNT_KINDS[0]);
    const paidPopup = mount.popup === true && kind.id !== "barbette" &&
      !adjustable;
    lines.push(sheetLine(kind.label.endsWith("turret") ? "turret" : "mount", {
      name: mountLineName(kind.label, adjustable || paidPopup),
      tons: kind.tons + (paidPopup ? POPUP_MOUNT.tons : 0),
      cost: round2(kind.cost + (paidPopup ? POPUP_MOUNT.cost : 0)),
      power: kind.power,
    }));
    const fitted = (mount.weapons ?? []).slice(
      0,
      mountWeaponSlots(kind.id, hullTons),
    ).flatMap((id, index) => {
      const priced = pricedWeapon(mount, index, id, hullTons);
      return priced ? [priced] : [];
    });
    if (kind.id !== "fixed" && !kind.label.endsWith("turret")) {
      for (const priced of fitted) {
        lines.push(
          sheetLine("weapon", {
            name: priced.item.label,
            tons: 0,
            cost: priced.cost,
            power: priced.power,
          }),
        );
      }
      continue;
    }
    const groups: {
      id: string;
      label: string;
      cost: number;
      power: number;
      count: number;
    }[] = [];
    for (const priced of fitted) {
      const group = groups.find((row) => row.id === priced.item.id);
      if (group) {
        group.count += 1;
        group.cost = round2(group.cost + priced.cost);
        group.power += priced.power;
        continue;
      }
      groups.push({
        id: priced.item.id,
        label: priced.item.label,
        cost: priced.cost,
        power: priced.power,
        count: 1,
      });
    }
    for (const group of groups) {
      lines.push(
        sheetLine("weapon", {
          name: countedName(group.label, group.count),
          tons: 0,
          cost: group.cost,
          power: group.power,
        }),
      );
    }
  }

  return { lines, errors, weaponPower, usedPoints };
}

import { skillSpecialties, specialtyLabel } from "./skills.ts";

/** A custom ship's brain from the Robot Handbook: a chassis with no locomotion and no manipulators. Costs are in credits until converted to MCr. */

export interface CustomShipBrain {
  /** Shown on the brain and its sheet line. Blank keeps the generic label. */
  name: string;
  /** Chassis size 1–6. A ship's brain this size takes no hull tonnage. */
  chassis: number;
  /** Protection added on top of the tech level's base armour. */
  armour: number;
  /** An Advanced or greater brain program. */
  programming: string;
  /** One bandwidth upgrade, or none. */
  bandwidthUpgrade: string;
  /** Intellect steps, 0–3. */
  intellect: number;
  hardened: boolean;
  options: string[];
  skills: BrainSkillFit[];
  /** Ava Ship's Avatars. Each costs Cr100,000 and takes no tonnage, power, or slots. */
  avatars: number;
}

export interface BrainSkillFit {
  id: string;
  skill: string;
  level: number;
  /** Empty at level 0. A higher level uses a core specialty when the skill has one. */
  specialty: string;
}

export interface BrainLine {
  name: string;
  tons: number;
  cost: number;
  /** A brain feature other than programming. The sheet folds these under the programming line. */
  fold?: "brain";
  /** The programming line. The sheet folds the rest of the brain under it. */
  head?: "brain";
}

export interface QuotedSkill {
  id: string;
  skill: string;
  label: string;
  specialty: string;
  level: number;
  bandwidth: number;
  /** Package level plus the characteristic DM. */
  effective: number;
  credits: number;
}

export interface CustomBrainQuote {
  lines: BrainLine[];
  errors: string[];
  warnings: string[];
  slotsUsed: number;
  slotsAvailable: number;
  bandwidthUsed: number;
  bandwidthAvailable: number;
  protection: number;
  intellect: number;
  skillDm: number;
  /** Set when haptics give the brain a DEX score equal to the ship's tech level. */
  dexterity?: number;
  /** DEX skills use this DM. It is 0 unless haptics are installed. */
  dexDm: number;
  builtIn: string;
  skills: QuotedSkill[];
}

const CHASSIS = [
  { size: 1, slots: 1, hits: 1, credits: 100 },
  { size: 2, slots: 2, hits: 4, credits: 200 },
  { size: 3, slots: 4, hits: 8, credits: 400 },
  { size: 4, slots: 8, hits: 12, credits: 800 },
  { size: 5, slots: 16, hits: 20, credits: 1000 },
  { size: 6, slots: 32, hits: 32, credits: 2000 },
] as const;

type BrainRank = "advanced" | "very" | "self" | "conscious";

const RANK: Record<BrainRank, number> = {
  advanced: 3,
  very: 4,
  self: 5,
  conscious: 6,
};

interface BrainProgram {
  id: string;
  label: string;
  tl: number;
  bandwidth: number;
  int: number;
  credits: number;
  rank: BrainRank;
  /** Very Advanced and above halve in price at each tech level after introduction. */
  retrotech: boolean;
  builtIn: string;
}

const PROGRAMS: BrainProgram[] = [
  {
    id: "advanced-10",
    label: "Advanced",
    tl: 10,
    bandwidth: 2,
    int: 6,
    credits: 100_000,
    rank: "advanced",
    retrotech: false,
    builtIn: "Intelligent Interface, Expert/1, Security/1",
  },
  {
    id: "advanced-11",
    label: "Advanced",
    tl: 11,
    bandwidth: 2,
    int: 7,
    credits: 50_000,
    rank: "advanced",
    retrotech: false,
    builtIn: "Intelligent Interface, Expert/1, Security/1",
  },
  {
    id: "advanced-12",
    label: "Advanced",
    tl: 12,
    bandwidth: 2,
    int: 8,
    credits: 10_000,
    rank: "advanced",
    retrotech: false,
    builtIn: "Intelligent Interface, Expert/1, Security/1",
  },
  {
    id: "very-12",
    label: "Very Advanced",
    tl: 12,
    bandwidth: 3,
    int: 9,
    credits: 500_000,
    rank: "very",
    retrotech: true,
    builtIn: "Intellect Interface, Expert/2, Security/2",
  },
  {
    id: "very-13",
    label: "Very Advanced",
    tl: 13,
    bandwidth: 4,
    int: 10,
    credits: 500_000,
    rank: "very",
    retrotech: true,
    builtIn: "Intellect Interface, Expert/2, Security/2",
  },
  {
    id: "very-14",
    label: "Very Advanced",
    tl: 14,
    bandwidth: 5,
    int: 11,
    credits: 500_000,
    rank: "very",
    retrotech: true,
    builtIn: "Intellect Interface, Expert/2, Security/2",
  },
  {
    id: "self-15",
    label: "Self-Aware",
    tl: 15,
    bandwidth: 10,
    int: 12,
    credits: 1_000_000,
    rank: "self",
    retrotech: true,
    builtIn: "Near sentient, Expert/3, Security/3",
  },
  {
    id: "self-16",
    label: "Self-Aware",
    tl: 16,
    bandwidth: 15,
    int: 13,
    credits: 1_000_000,
    rank: "self",
    retrotech: true,
    builtIn: "Near sentient, Expert/3, Security/3",
  },
  {
    id: "conscious-17",
    label: "Conscious",
    tl: 17,
    bandwidth: 20,
    int: 15,
    credits: 5_000_000,
    rank: "conscious",
    retrotech: true,
    builtIn: "Conscious Intelligence, Security/3",
  },
  {
    id: "conscious-18",
    label: "Conscious",
    tl: 18,
    bandwidth: 30,
    int: 15,
    credits: 1_000_000,
    rank: "conscious",
    retrotech: true,
    builtIn: "Conscious Intelligence, Security/3",
  },
];

interface BandwidthUpgrade {
  id: string;
  label: string;
  min: BrainRank | "basic";
  tl: number;
  bandwidth: number;
  credits: number;
}

const UPGRADES: BandwidthUpgrade[] = [
  {
    id: "basic-1",
    label: "+1",
    min: "basic",
    tl: 8,
    bandwidth: 1,
    credits: 5_000,
  },
  {
    id: "advanced-2",
    label: "+2",
    min: "advanced",
    tl: 10,
    bandwidth: 2,
    credits: 5_000,
  },
  {
    id: "advanced-3",
    label: "+3",
    min: "advanced",
    tl: 11,
    bandwidth: 3,
    credits: 10_000,
  },
  {
    id: "advanced-4",
    label: "+4",
    min: "advanced",
    tl: 12,
    bandwidth: 4,
    credits: 20_000,
  },
  {
    id: "very-6",
    label: "+6",
    min: "very",
    tl: 12,
    bandwidth: 6,
    credits: 50_000,
  },
  {
    id: "very-8",
    label: "+8",
    min: "very",
    tl: 12,
    bandwidth: 8,
    credits: 100_000,
  },
  {
    id: "self-10",
    label: "+10",
    min: "self",
    tl: 15,
    bandwidth: 10,
    credits: 500_000,
  },
  {
    id: "self-15",
    label: "+15",
    min: "self",
    tl: 15,
    bandwidth: 15,
    credits: 1_000_000,
  },
  {
    id: "self-20",
    label: "+20",
    min: "self",
    tl: 15,
    bandwidth: 20,
    credits: 2_500_000,
  },
  {
    id: "self-25",
    label: "+25",
    min: "self",
    tl: 15,
    bandwidth: 25,
    credits: 5_000_000,
  },
  {
    id: "conscious-30",
    label: "+30",
    min: "conscious",
    tl: 17,
    bandwidth: 30,
    credits: 5_000_000,
  },
  {
    id: "conscious-40",
    label: "+40",
    min: "conscious",
    tl: 17,
    bandwidth: 40,
    credits: 10_000_000,
  },
  {
    id: "conscious-50",
    label: "+50",
    min: "conscious",
    tl: 18,
    bandwidth: 50,
    credits: 5_000_000,
  },
];

const MIN_RANK: Record<BandwidthUpgrade["min"], number> = { basic: 2, ...RANK };

interface ArmourBand {
  tl: number;
  base: number;
  max: number;
  /** Fraction of base slots per point of added armour. */
  percent: number;
  perSlot: number;
  credits: number;
}

const ARMOUR: ArmourBand[] = [
  { tl: 6, base: 2, max: 20, percent: 0.01, perSlot: 1, credits: 250 },
  { tl: 9, base: 3, max: 30, percent: 0.005, perSlot: 2, credits: 1_000 },
  { tl: 12, base: 4, max: 40, percent: 0.004, perSlot: 3, credits: 1_500 },
  { tl: 15, base: 4, max: 50, percent: 0.003, perSlot: 4, credits: 2_500 },
  { tl: 18, base: 5, max: 60, percent: 0.0025, perSlot: 5, credits: 5_000 },
];

type OptionCost = { kind: "flat"; credits: number } | {
  kind: "perBaseSlot";
  credits: number;
};

interface BrainOption {
  id: string;
  label: string;
  tl: number;
  /** Physical slots. Zero-slot options spend a slot only after the Size + TL allowance. */
  slots: number;
  /** Fraction of base slots, rounded up to at least one. Used instead of slots. */
  slotPercent?: number;
  zero: boolean;
  cost: OptionCost;
}

const OPTIONS: BrainOption[] = [
  {
    id: "visual",
    label: "Visual spectrum sensor",
    tl: 7,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 50 },
  },
  {
    id: "auditory",
    label: "Auditory sensor",
    tl: 5,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 10 },
  },
  {
    id: "auditory-broad",
    label: "Auditory sensor (broad spectrum)",
    tl: 8,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 200 },
  },
  {
    id: "voder",
    label: "Voder speaker",
    tl: 8,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 100 },
  },
  {
    id: "voder-broad",
    label: "Voder speaker (broad spectrum)",
    tl: 10,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 500 },
  },
  {
    id: "wireless",
    label: "Wireless data link",
    tl: 8,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 10 },
  },
  {
    id: "drone-interface",
    label: "Drone interface",
    tl: 6,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 100 },
  },
  {
    id: "encryption",
    label: "Encryption module",
    tl: 6,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 4_000 },
  },
  {
    id: "video-basic",
    label: "Video screen (basic)",
    tl: 7,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 200 },
  },
  {
    id: "video-improved",
    label: "Video screen (improved)",
    tl: 8,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 500 },
  },
  {
    id: "video-advanced",
    label: "Video screen (advanced)",
    tl: 10,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 2_000 },
  },
  {
    id: "transceiver-5",
    label: "Transceiver 5km (basic)",
    tl: 7,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 250 },
  },
  {
    id: "transceiver-5-improved",
    label: "Transceiver 5km (improved)",
    tl: 8,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 100 },
  },
  {
    id: "transceiver-50",
    label: "Transceiver 50km (improved)",
    tl: 8,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 500 },
  },
  {
    id: "transceiver-50-enhanced",
    label: "Transceiver 50km (enhanced)",
    tl: 10,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 250 },
  },
  {
    id: "transceiver-50-advanced",
    label: "Transceiver 50km (advanced)",
    tl: 13,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 100 },
  },
  {
    id: "transceiver-500",
    label: "Transceiver 500km (improved)",
    tl: 9,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 1_000 },
  },
  {
    id: "transceiver-500-enhanced",
    label: "Transceiver 500km (enhanced)",
    tl: 11,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 500 },
  },
  {
    id: "transceiver-500-advanced",
    label: "Transceiver 500km (advanced)",
    tl: 14,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 250 },
  },
  {
    id: "transceiver-5000",
    label: "Transceiver 5,000km (improved)",
    tl: 9,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 5_000 },
  },
  {
    id: "transceiver-5000-enhanced",
    label: "Transceiver 5,000km (enhanced)",
    tl: 12,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 1_000 },
  },
  {
    id: "thermal",
    label: "Thermal sensor",
    tl: 6,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 500 },
  },
  {
    id: "light",
    label: "Light intensifier",
    tl: 7,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 500 },
  },
  {
    id: "light-advanced",
    label: "Light intensifier (advanced)",
    tl: 9,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 1_250 },
  },
  {
    id: "geiger",
    label: "Geiger counter",
    tl: 8,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 400 },
  },
  {
    id: "atmospheric",
    label: "Atmospheric sensor",
    tl: 8,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 100 },
  },
  {
    id: "olfactory",
    label: "Olfactory sensor",
    tl: 8,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 1_000 },
  },
  {
    id: "olfactory-improved",
    label: "Olfactory sensor (improved)",
    tl: 10,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 3_500 },
  },
  {
    id: "olfactory-advanced",
    label: "Olfactory sensor (advanced)",
    tl: 12,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 10_000 },
  },
  {
    id: "pris",
    label: "PRIS sensor",
    tl: 12,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 2_000 },
  },
  {
    id: "environment",
    label: "Environment processor",
    tl: 10,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 10_000 },
  },
  {
    id: "injector",
    label: "Injector needle",
    tl: 7,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 20 },
  },
  {
    id: "stinger",
    label: "Stinger",
    tl: 7,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 10 },
  },
  {
    id: "designator",
    label: "Laser designator",
    tl: 7,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 500 },
  },
  {
    id: "parasitic",
    label: "Parasitic link",
    tl: 10,
    slots: 0,
    zero: true,
    cost: { kind: "flat", credits: 10_000 },
  },
  {
    id: "hostile",
    label: "Hostile environment protection",
    tl: 6,
    slots: 0,
    zero: true,
    cost: { kind: "perBaseSlot", credits: 300 },
  },
  {
    id: "vacuum",
    label: "Vacuum environment protection",
    tl: 7,
    slots: 0,
    zero: true,
    cost: { kind: "perBaseSlot", credits: 600 },
  },
  {
    id: "vacuum-bio",
    label: "Vacuum environment protection (biological)",
    tl: 10,
    slots: 0,
    zero: true,
    cost: { kind: "perBaseSlot", credits: 50_000 },
  },
  {
    id: "reflec",
    label: "Reflec armour",
    tl: 10,
    slots: 0,
    zero: true,
    cost: { kind: "perBaseSlot", credits: 100 },
  },
  {
    id: "camo-visual-primitive",
    label: "Visual camouflage (primitive)",
    tl: 1,
    slots: 0,
    zero: true,
    cost: { kind: "perBaseSlot", credits: 1 },
  },
  {
    id: "camo-visual-basic",
    label: "Visual camouflage (basic)",
    tl: 4,
    slots: 0,
    zero: true,
    cost: { kind: "perBaseSlot", credits: 4 },
  },
  {
    id: "camo-visual-improved",
    label: "Visual camouflage (improved)",
    tl: 7,
    slots: 0,
    zero: true,
    cost: { kind: "perBaseSlot", credits: 40 },
  },
  {
    id: "camo-visual-enhanced",
    label: "Visual camouflage (enhanced)",
    tl: 11,
    slots: 0,
    zero: true,
    cost: { kind: "perBaseSlot", credits: 100 },
  },
  {
    id: "camo-visual",
    label: "Visual camouflage (advanced)",
    tl: 12,
    slots: 0,
    zero: true,
    cost: { kind: "perBaseSlot", credits: 500 },
  },
  {
    id: "camo-visual-superior",
    label: "Visual camouflage (superior)",
    tl: 13,
    slots: 0,
    zero: true,
    cost: { kind: "perBaseSlot", credits: 2_500 },
  },
  {
    id: "camo-audible-basic",
    label: "Audible camouflage (basic)",
    tl: 5,
    slots: 0,
    zero: true,
    cost: { kind: "perBaseSlot", credits: 5 },
  },
  {
    id: "camo-audible-improved",
    label: "Audible camouflage (improved)",
    tl: 8,
    slots: 0,
    zero: true,
    cost: { kind: "perBaseSlot", credits: 10 },
  },
  {
    id: "camo-audible",
    label: "Audible camouflage (advanced)",
    tl: 10,
    slots: 0,
    zero: true,
    cost: { kind: "perBaseSlot", credits: 50 },
  },
  {
    id: "camo-olfactory-basic",
    label: "Olfactory camouflage (basic)",
    tl: 7,
    slots: 0,
    zero: true,
    cost: { kind: "perBaseSlot", credits: 10 },
  },
  {
    id: "camo-olfactory-improved",
    label: "Olfactory camouflage (improved)",
    tl: 9,
    slots: 0,
    zero: true,
    cost: { kind: "perBaseSlot", credits: 20 },
  },
  {
    id: "camo-olfactory",
    label: "Olfactory camouflage (advanced)",
    tl: 12,
    slots: 0,
    zero: true,
    cost: { kind: "perBaseSlot", credits: 100 },
  },
  {
    id: "gecko",
    label: "Gecko grippers",
    tl: 9,
    slots: 0,
    zero: true,
    cost: { kind: "perBaseSlot", credits: 500 },
  },
  {
    id: "magnetic",
    label: "Magnetic grippers",
    tl: 8,
    slots: 0,
    zero: true,
    cost: { kind: "perBaseSlot", credits: 10 },
  },
  {
    id: "maintain",
    label: "Self-maintenance (basic)",
    tl: 7,
    slots: 0,
    zero: true,
    cost: { kind: "perBaseSlot", credits: 20_000 },
  },
  {
    id: "maintain-improved",
    label: "Self-maintenance (improved)",
    tl: 8,
    slots: 0,
    zero: true,
    cost: { kind: "perBaseSlot", credits: 50_000 },
  },
  {
    id: "radiation",
    label: "Radiation environment protection",
    tl: 7,
    slots: 1,
    zero: false,
    cost: { kind: "perBaseSlot", credits: 600 },
  },
  {
    id: "medikit",
    label: "Medikit (basic)",
    tl: 8,
    slots: 1,
    zero: false,
    cost: { kind: "flat", credits: 1_000 },
  },
  {
    id: "medikit-improved",
    label: "Medikit (improved)",
    tl: 10,
    slots: 1,
    zero: false,
    cost: { kind: "flat", credits: 1_500 },
  },
  {
    id: "medikit-enhanced",
    label: "Medikit (enhanced)",
    tl: 12,
    slots: 1,
    zero: false,
    cost: { kind: "flat", credits: 5_000 },
  },
  {
    id: "medikit-advanced",
    label: "Medikit (advanced)",
    tl: 14,
    slots: 1,
    zero: false,
    cost: { kind: "flat", credits: 10_000 },
  },
  {
    id: "toolkit-basic",
    label: "Starship engineering toolkit (basic)",
    tl: 8,
    slots: 6,
    zero: false,
    cost: { kind: "flat", credits: 1_000 },
  },
  {
    id: "toolkit-improved",
    label: "Starship engineering toolkit (improved)",
    tl: 10,
    slots: 5,
    zero: false,
    cost: { kind: "flat", credits: 2_000 },
  },
  {
    id: "toolkit-enhanced",
    label: "Starship engineering toolkit (enhanced)",
    tl: 12,
    slots: 5,
    zero: false,
    cost: { kind: "flat", credits: 4_000 },
  },
  {
    id: "toolkit-advanced",
    label: "Starship engineering toolkit (advanced)",
    tl: 14,
    slots: 4,
    zero: false,
    cost: { kind: "flat", credits: 10_000 },
  },
  {
    id: "electronics",
    label: "Electronics toolkit (basic)",
    tl: 6,
    slots: 1,
    zero: false,
    cost: { kind: "flat", credits: 2_000 },
  },
  {
    id: "external-power",
    label: "External power",
    tl: 9,
    slots: 0,
    slotPercent: 0.05,
    zero: false,
    cost: { kind: "perBaseSlot", credits: 100 },
  },
  {
    id: "drone-basic",
    label: "Robotic drone controller (basic)",
    tl: 7,
    slots: 2,
    zero: false,
    cost: { kind: "flat", credits: 2_000 },
  },
  {
    id: "drone-improved",
    label: "Robotic drone controller (improved)",
    tl: 9,
    slots: 1,
    zero: false,
    cost: { kind: "flat", credits: 10_000 },
  },
  {
    id: "drone-enhanced",
    label: "Robotic drone controller (enhanced)",
    tl: 10,
    slots: 1,
    zero: false,
    cost: { kind: "flat", credits: 20_000 },
  },
  {
    id: "drone-advanced",
    label: "Robotic drone controller (advanced)",
    tl: 11,
    slots: 1,
    zero: false,
    cost: { kind: "flat", credits: 50_000 },
  },
  {
    id: "swarm-basic",
    label: "Swarm controller (basic)",
    tl: 8,
    slots: 3,
    zero: false,
    cost: { kind: "flat", credits: 10_000 },
  },
  {
    id: "swarm-improved",
    label: "Swarm controller (improved)",
    tl: 10,
    slots: 2,
    zero: false,
    cost: { kind: "flat", credits: 20_000 },
  },
  {
    id: "swarm-enhanced",
    label: "Swarm controller (enhanced)",
    tl: 12,
    slots: 1,
    zero: false,
    cost: { kind: "flat", credits: 50_000 },
  },
  {
    id: "swarm-advanced",
    label: "Swarm controller (advanced)",
    tl: 14,
    slots: 1,
    zero: false,
    cost: { kind: "flat", credits: 100_000 },
  },
  {
    id: "avatar-basic",
    label: "Avatar controller (basic)",
    tl: 11,
    slots: 2,
    zero: false,
    cost: { kind: "flat", credits: 50_000 },
  },
  {
    id: "avatar-improved",
    label: "Avatar controller (improved)",
    tl: 13,
    slots: 1,
    zero: false,
    cost: { kind: "flat", credits: 200_000 },
  },
  {
    id: "avatar-enhanced",
    label: "Avatar controller (enhanced)",
    tl: 14,
    slots: 1,
    zero: false,
    cost: { kind: "flat", credits: 500_000 },
  },
  {
    id: "avatar-receiver",
    label: "Avatar receiver",
    tl: 11,
    slots: 1,
    zero: false,
    cost: { kind: "flat", credits: 10_000 },
  },
];

/** Fitted on every ship's brain, so they are not offered again in the option list. */
const INCLUDED_OPTIONS = new Set([
  "visual",
  "auditory",
  "voder",
  "wireless",
  "transceiver-5",
  "external-power",
]);

type SkillCharacteristic = "int" | "dex" | "str";

interface BrainSkill {
  id: string;
  label: string;
  tl: number;
  bandwidth: number;
  credits: number;
  characteristic: SkillCharacteristic;
}

const SKILLS: BrainSkill[] = [
  {
    id: "admin",
    label: "Admin",
    tl: 8,
    bandwidth: 0,
    credits: 100,
    characteristic: "int",
  },
  {
    id: "advocate",
    label: "Advocate",
    tl: 10,
    bandwidth: 0,
    credits: 500,
    characteristic: "int",
  },
  {
    id: "animals",
    label: "Animals",
    tl: 9,
    bandwidth: 0,
    credits: 200,
    characteristic: "dex",
  },
  {
    id: "art",
    label: "Art",
    tl: 10,
    bandwidth: 0,
    credits: 500,
    characteristic: "int",
  },
  {
    id: "astrogation",
    label: "Astrogation",
    tl: 12,
    bandwidth: 1,
    credits: 500,
    characteristic: "int",
  },
  {
    id: "athletics",
    label: "Athletics",
    tl: 8,
    bandwidth: 0,
    credits: 100,
    characteristic: "str",
  },
  {
    id: "broker",
    label: "Broker",
    tl: 10,
    bandwidth: 0,
    credits: 200,
    characteristic: "int",
  },
  {
    id: "carouse",
    label: "Carouse",
    tl: 11,
    bandwidth: 1,
    credits: 500,
    characteristic: "int",
  },
  {
    id: "deception",
    label: "Deception",
    tl: 13,
    bandwidth: 1,
    credits: 1_000,
    characteristic: "int",
  },
  {
    id: "diplomat",
    label: "Diplomat",
    tl: 10,
    bandwidth: 1,
    credits: 500,
    characteristic: "int",
  },
  {
    id: "drive",
    label: "Drive",
    tl: 8,
    bandwidth: 0,
    credits: 100,
    characteristic: "dex",
  },
  {
    id: "electronics",
    label: "Electronics",
    tl: 8,
    bandwidth: 0,
    credits: 100,
    characteristic: "int",
  },
  {
    id: "engineer",
    label: "Engineer",
    tl: 9,
    bandwidth: 0,
    credits: 200,
    characteristic: "int",
  },
  {
    id: "explosives",
    label: "Explosives",
    tl: 8,
    bandwidth: 0,
    credits: 100,
    characteristic: "int",
  },
  {
    id: "flyer",
    label: "Flyer",
    tl: 8,
    bandwidth: 0,
    credits: 100,
    characteristic: "dex",
  },
  {
    id: "gambler",
    label: "Gambler",
    tl: 10,
    bandwidth: 0,
    credits: 500,
    characteristic: "int",
  },
  {
    id: "gunCombat",
    label: "Gun Combat",
    tl: 8,
    bandwidth: 0,
    credits: 100,
    characteristic: "dex",
  },
  {
    id: "gunner",
    label: "Gunner",
    tl: 8,
    bandwidth: 0,
    credits: 100,
    characteristic: "dex",
  },
  {
    id: "heavyWeapons",
    label: "Heavy Weapons",
    tl: 8,
    bandwidth: 0,
    credits: 100,
    characteristic: "dex",
  },
  {
    id: "investigate",
    label: "Investigate",
    tl: 11,
    bandwidth: 1,
    credits: 500,
    characteristic: "int",
  },
  {
    id: "language",
    label: "Language",
    tl: 9,
    bandwidth: 0,
    credits: 200,
    characteristic: "int",
  },
  {
    id: "leadership",
    label: "Leadership",
    tl: 13,
    bandwidth: 1,
    credits: 1_000,
    characteristic: "int",
  },
  {
    id: "mechanic",
    label: "Mechanic",
    tl: 8,
    bandwidth: 0,
    credits: 100,
    characteristic: "int",
  },
  {
    id: "medic",
    label: "Medic",
    tl: 9,
    bandwidth: 0,
    credits: 200,
    characteristic: "int",
  },
  {
    id: "melee",
    label: "Melee",
    tl: 8,
    bandwidth: 0,
    credits: 100,
    characteristic: "dex",
  },
  {
    id: "navigation",
    label: "Navigation",
    tl: 8,
    bandwidth: 0,
    credits: 100,
    characteristic: "int",
  },
  {
    id: "persuade",
    label: "Persuade",
    tl: 11,
    bandwidth: 1,
    credits: 500,
    characteristic: "int",
  },
  {
    id: "pilot",
    label: "Pilot",
    tl: 8,
    bandwidth: 0,
    credits: 100,
    characteristic: "dex",
  },
  {
    id: "profession",
    label: "Profession",
    tl: 9,
    bandwidth: 0,
    credits: 200,
    characteristic: "int",
  },
  {
    id: "recon",
    label: "Recon",
    tl: 10,
    bandwidth: 0,
    credits: 500,
    characteristic: "int",
  },
  {
    id: "science",
    label: "Science",
    tl: 9,
    bandwidth: 0,
    credits: 200,
    characteristic: "int",
  },
  {
    id: "seafarer",
    label: "Seafarer",
    tl: 8,
    bandwidth: 0,
    credits: 100,
    characteristic: "dex",
  },
  {
    id: "stealth",
    label: "Stealth",
    tl: 10,
    bandwidth: 0,
    credits: 500,
    characteristic: "dex",
  },
  {
    id: "steward",
    label: "Steward",
    tl: 8,
    bandwidth: 0,
    credits: 100,
    characteristic: "int",
  },
  {
    id: "streetwise",
    label: "Streetwise",
    tl: 13,
    bandwidth: 1,
    credits: 1_000,
    characteristic: "int",
  },
  {
    id: "survival",
    label: "Survival",
    tl: 10,
    bandwidth: 0,
    credits: 200,
    characteristic: "int",
  },
  {
    id: "tactics",
    label: "Tactics",
    tl: 8,
    bandwidth: 0,
    credits: 100,
    characteristic: "int",
  },
];

function whole(value: number, fallback = 0): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : fallback;
}

function mcr(credits: number): number {
  return Math.round(credits) / 1_000_000;
}

/** Traveller characteristic modifier. */
export function characteristicDm(score: number): number {
  if (score <= 0) return -3;
  if (score <= 2) return -2;
  if (score <= 5) return -1;
  if (score <= 8) return 0;
  if (score <= 11) return 1;
  if (score <= 14) return 2;
  return 3;
}

function chassisOf(size: number) {
  const found = CHASSIS.find((row) => row.size === size);
  return found ?? CHASSIS[0];
}

function armourBand(techLevel: number): ArmourBand {
  return [...ARMOUR].reverse().find((band) => techLevel >= band.tl) ??
    ARMOUR[0];
}

export function programsAt(techLevel: number): BrainProgram[] {
  return PROGRAMS.filter((program) => program.tl <= techLevel);
}

export function upgradesAt(
  techLevel: number,
  rank: BrainRank | undefined,
): BandwidthUpgrade[] {
  if (!rank) return [];
  return UPGRADES.filter((upgrade) =>
    techLevel >= upgrade.tl && RANK[rank] >= MIN_RANK[upgrade.min]
  );
}

export function optionSlotCount(
  option: BrainOption,
  baseSlots: number,
): number {
  if (option.slotPercent) {
    return Math.max(1, Math.ceil(option.slotPercent * baseSlots));
  }
  return option.slots;
}

export function includedBrainOption(id: string): boolean {
  return INCLUDED_OPTIONS.has(id);
}

export function optionsAt(techLevel: number): BrainOption[] {
  return OPTIONS.filter((option) =>
    option.tl <= techLevel && !INCLUDED_OPTIONS.has(option.id)
  ).sort((left, right) => left.label.localeCompare(right.label));
}

export function skillsAt(techLevel: number): BrainSkill[] {
  return SKILLS.filter((skill) => skill.tl <= techLevel);
}

/** Installed skill packages, by skill name, then specialty, then level. */
export function compareSkillFits(
  left: BrainSkillFit,
  right: BrainSkillFit,
): number {
  const leftSkill = SKILLS.find((row) => row.id === left.skill);
  const rightSkill = SKILLS.find((row) => row.id === right.skill);
  const byLabel = (leftSkill?.label ?? left.skill).localeCompare(
    rightSkill?.label ?? right.skill,
  );
  if (byLabel !== 0) return byLabel;
  const leftSpecialty = leftSkill && left.specialty
    ? specialtyLabel(leftSkill.label, left.specialty)
    : left.specialty;
  const rightSpecialty = rightSkill && right.specialty
    ? specialtyLabel(rightSkill.label, right.specialty)
    : right.specialty;
  const bySpecialty = leftSpecialty.localeCompare(rightSpecialty);
  if (bySpecialty !== 0) return bySpecialty;
  return left.level - right.level || left.id.localeCompare(right.id);
}

export function programCost(program: BrainProgram, techLevel: number): number {
  if (!program.retrotech || techLevel <= program.tl) return program.credits;
  return program.credits * 0.5 ** (techLevel - program.tl);
}

/** Bandwidth a skill package needs. A level 0 package uses its listed bandwidth; each further level adds one. */
export function skillBandwidth(skill: BrainSkill, level: number): number {
  return skill.bandwidth + level;
}

/** Price of a skill package. Each level multiplies the level-0 price by ten, up to level 3. */
export function skillCredits(skill: BrainSkill, level: number): number {
  return skill.credits * 10 ** level;
}

export function defaultProgramming(techLevel: number): string {
  const rows = programsAt(techLevel);
  const advanced = [...rows].reverse().find((program) =>
    program.rank === "advanced"
  );
  return (advanced ?? rows[0])?.id ?? "advanced-12";
}

export function blankCustomShipBrain(techLevel = 12): CustomShipBrain {
  return {
    name: "",
    chassis: 1,
    armour: 0,
    programming: defaultProgramming(techLevel),
    bandwidthUpgrade: "",
    intellect: 0,
    hardened: false,
    options: [],
    skills: [],
    avatars: 0,
  };
}

export function customBrainFrom(value: unknown): CustomShipBrain | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Partial<CustomShipBrain>;
  const programming = PROGRAMS.some((program) => program.id === row.programming)
    ? row.programming!
    : "advanced-12";
  const bandwidthUpgrade =
    UPGRADES.some((upgrade) => upgrade.id === row.bandwidthUpgrade)
      ? row.bandwidthUpgrade!
      : "";
  const seenOptions = new Set<string>();
  const options = Array.isArray(row.options)
    ? row.options.filter((id): id is string => {
      if (
        typeof id !== "string" || INCLUDED_OPTIONS.has(id) ||
        !OPTIONS.some((option) => option.id === id) || seenOptions.has(id)
      ) return false;
      seenOptions.add(id);
      return true;
    })
    : [];
  const seenIds = new Set<string>();
  const skills = Array.isArray(row.skills)
    ? row.skills.flatMap((fit) => {
      if (!fit || typeof fit !== "object") return [];
      const source = fit as Partial<BrainSkillFit>;
      const skill = SKILLS.find((row) => row.id === source.skill);
      if (!skill) return [];
      const level = Math.min(3, whole(source.level ?? 0));
      const requested = typeof source.id === "string" ? source.id : "";
      const id = requested && !seenIds.has(requested)
        ? requested
        : crypto.randomUUID();
      seenIds.add(id);
      return [{
        id,
        skill: skill.id,
        level,
        specialty: level > 0
          ? matchedSpecialty(skill.label, source.specialty)
          : "",
      }];
    })
    : [];
  return {
    name: typeof row.name === "string" ? row.name.trim() : "",
    chassis: Math.min(6, Math.max(1, whole(row.chassis ?? 1, 1))),
    armour: whole(row.armour ?? 0),
    programming,
    bandwidthUpgrade,
    intellect: Math.min(3, whole(row.intellect ?? 0)),
    hardened: row.hardened === true,
    options,
    skills,
    avatars: whole(row.avatars ?? 0),
  };
}

function matchedSpecialty(label: string, value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  return skillSpecialties(label).find((item) =>
    item.toLowerCase() === text.toLowerCase() ||
    specialtyLabel(label, item).toLowerCase() === text.toLowerCase()
  ) ?? "";
}

function intellectQuote(
  baseInt: number,
  steps: number,
): { int: number; bandwidth: number; credits: number } {
  const count = Math.min(3, Math.max(0, steps));
  if (count === 0) return { int: baseInt, bandwidth: 0, credits: 0 };
  let product = 1;
  for (let step = 1; step <= count; step += 1) product *= baseInt + step;
  const int = baseInt + count;
  const credits = product * 1_000 * (int >= 12 ? 2 : 1);
  const bandwidth = count === 1 ? 1 : count === 2 ? 3 : 6;
  return { int, bandwidth, credits };
}

function armourQuote(
  techLevel: number,
  points: number,
  baseSlots: number,
): {
  protection: number;
  added: number;
  slots: number;
  credits: number;
  max: number;
} {
  const band = armourBand(techLevel);
  const added = Math.min(band.max, Math.max(0, points));
  if (added === 0) {
    return {
      protection: band.base,
      added: 0,
      slots: 0,
      credits: 0,
      max: band.max,
    };
  }
  const byPercent = Math.ceil(added * band.percent * baseSlots);
  const byCap = Math.ceil(added / band.perSlot);
  const slots = Math.max(1, byPercent, byCap);
  return {
    protection: band.base + added,
    added,
    slots,
    credits: slots * band.credits,
    max: band.max,
  };
}

/** Price a custom ship's brain at the ship's tech level. The chassis has no locomotion and both manipulators are removed. */
export function quoteCustomShipBrain(
  brain: CustomShipBrain | undefined,
  techLevel: number,
  haptics = false,
): CustomBrainQuote {
  const spec = brain ?? blankCustomShipBrain(techLevel);
  const level = Number.isFinite(techLevel) ? Math.trunc(techLevel) : 0;
  const hull = chassisOf(Math.min(6, Math.max(1, whole(spec.chassis, 1))));
  const errors: string[] = [];
  const warnings: string[] = [];
  const lines: BrainLine[] = [];

  const baseChassis = hull.credits;
  const manipulatorSaving = Math.min(100 * hull.size, baseChassis * 0.2);
  const chassisCredits = baseChassis - manipulatorSaving * 2;
  const slotsFromLocomotion = Math.ceil(hull.slots * 0.25);
  const slotsFromManipulator = Math.max(1, Math.ceil(hull.slots * 0.1));
  const slotsAvailable = hull.slots + slotsFromLocomotion +
    slotsFromManipulator * 2;

  const armour = armourQuote(level, spec.armour, hull.slots);
  if (spec.armour > armour.max) {
    errors.push(`Armour cannot exceed +${armour.max} at tech level ${level}.`);
  }
  let slotsUsed = armour.slots;

  const availablePrograms = programsAt(level);
  const program = PROGRAMS.find((row) => row.id === spec.programming);
  if (availablePrograms.length === 0) {
    errors.push(
      "A ship's brain requires an Advanced brain, available at tech level 10.",
    );
  }
  if (!program || program.tl > level) {
    errors.push("Choose a brain available at this tech level.");
  }

  let programCredits = 0;
  let baseBandwidth = 0;
  let intellect = 0;
  let skillDm = 0;
  const dexterity = haptics ? level : undefined;
  const dexDm = haptics ? characteristicDm(level) : 0;
  let builtIn = "";
  if (program && program.tl <= level) {
    programCredits = programCost(program, level);
    baseBandwidth = program.bandwidth;
    const title = spec.name.trim() || "Ship's brain";
    lines.push({
      name: `${title} (${program.label}, TL${program.tl})`,
      tons: 0,
      cost: mcr(programCredits),
      head: "brain",
    });
    builtIn = program.builtIn;
    const housing = program.bandwidth - Math.max(0, level - program.tl);
    if (hull.size < Math.max(1, housing)) slotsUsed += 1;
  }
  lines.push({
    name: `Ship's brain chassis (Size ${hull.size})`,
    tons: 0,
    cost: mcr(chassisCredits),
    fold: "brain",
  });
  if (armour.added > 0) {
    lines.push({
      name: `Brain armour (+${armour.added})`,
      tons: 0,
      cost: mcr(armour.credits),
      fold: "brain",
    });
  }

  const upgrade = UPGRADES.find((row) => row.id === spec.bandwidthUpgrade);
  let upgradeCredits = 0;
  let upgradeBandwidth = 0;
  if (upgrade) {
    const allowed = program && program.tl <= level &&
      upgradesAt(level, program.rank).some((row) => row.id === upgrade.id);
    if (!allowed) {
      errors.push(
        `${upgrade.label} bandwidth needs a brain of at least ${upgrade.min} sophistication at tech level ${upgrade.tl}.`,
      );
    }
    upgradeCredits = upgrade.credits;
    upgradeBandwidth = upgrade.bandwidth;
    slotsUsed += 1;
    lines.push({
      name: `Brain bandwidth upgrade (${upgrade.label})`,
      tons: 0,
      cost: mcr(upgradeCredits),
      fold: "brain",
    });
  }

  const grown = program && program.tl <= level
    ? intellectQuote(program.int, spec.intellect)
    : { int: 0, bandwidth: 0, credits: 0 };
  intellect = grown.int;
  skillDm = characteristicDm(intellect);
  if (grown.credits > 0) {
    lines.push({
      name: `Brain intellect upgrade (+${spec.intellect})`,
      tons: 0,
      cost: mcr(grown.credits),
      fold: "brain",
    });
  }
  const bandwidthAvailable = Math.max(
    0,
    baseBandwidth + upgradeBandwidth - grown.bandwidth,
  );
  if (grown.bandwidth > baseBandwidth + upgradeBandwidth) {
    errors.push(
      `Intellect upgrade needs ${grown.bandwidth} bandwidth and the brain has ${
        baseBandwidth + upgradeBandwidth
      }.`,
    );
  }

  if (spec.hardened && program && program.tl <= level) {
    lines.push({
      name: "Brain hardening",
      tons: 0,
      cost: mcr((programCredits + upgradeCredits) * 0.5),
      fold: "brain",
    });
  }

  const avatars = whole(spec.avatars ?? 0);
  if (avatars > 0) {
    lines.push({
      name: avatars > 1 ? `Ava Ship's Avatar x${avatars}` : "Ava Ship's Avatar",
      tons: 0,
      cost: mcr(100_000 * avatars),
      fold: "brain",
    });
  }

  const power = OPTIONS.find((option) => option.id === "external-power");
  if (power && level >= power.tl) {
    slotsUsed += optionSlotCount(power, hull.slots);
    const credits = power.cost.kind === "flat"
      ? power.cost.credits
      : power.cost.credits * hull.slots;
    lines.push({
      name: power.label,
      tons: 0,
      cost: mcr(credits),
      fold: "brain",
    });
  }

  const fittedOptions = spec.options.flatMap((id) => {
    if (INCLUDED_OPTIONS.has(id)) return [];
    const option = OPTIONS.find((row) => row.id === id);
    return option ? [option] : [];
  });
  const zeroCount = fittedOptions.filter((option) => option.zero).length;
  const zeroAllowance = hull.size + Math.max(0, level);
  slotsUsed += Math.max(0, zeroCount - zeroAllowance);
  for (const option of fittedOptions) {
    if (option.tl > level) {
      errors.push(`${option.label} requires tech level ${option.tl}.`);
    }
    if (!option.zero) slotsUsed += optionSlotCount(option, hull.slots);
    const credits = option.cost.kind === "flat"
      ? option.cost.credits
      : option.cost.credits * hull.slots;
    lines.push({
      name: option.label,
      tons: 0,
      cost: mcr(credits),
      fold: "brain",
    });
  }
  if (slotsUsed > slotsAvailable) {
    errors.push(
      `Brain options use ${slotsUsed} slots and the chassis has ${slotsAvailable}.`,
    );
  }

  let bandwidthUsed = 0;
  let zeroSkills = 0;
  const quotedSkills: QuotedSkill[] = [];
  for (const fit of [...spec.skills].sort(compareSkillFits)) {
    const skill = SKILLS.find((row) => row.id === fit.skill);
    if (!skill) continue;
    const skillLevel = Math.min(3, Math.max(0, whole(fit.level)));
    const bandwidth = skillBandwidth(skill, skillLevel);
    const credits = skillCredits(skill, skillLevel);
    const score = skill.characteristic === "int"
      ? intellect
      : skill.characteristic === "dex"
      ? dexterity ?? 0
      : 0;
    const dm = skill.characteristic === "dex" ? dexDm : characteristicDm(score);
    const effective = skillLevel + dm;
    const specialties = skillSpecialties(skill.label);
    const specialty = skillLevel > 0
      ? matchedSpecialty(skill.label, fit.specialty)
      : "";
    if (skill.tl + skillLevel > level) {
      errors.push(
        `${skill.label} ${skillLevel} requires tech level ${
          skill.tl + skillLevel
        }.`,
      );
    }
    if (skillLevel > 0 && specialties.length > 0 && !specialty) {
      errors.push(`${skill.label} ${skillLevel} needs a specialty.`);
    }
    if (program && bandwidth > program.bandwidth) {
      errors.push(
        `${skill.label} ${skillLevel} needs bandwidth ${bandwidth} and this brain's inherent bandwidth is ${program.bandwidth}.`,
      );
    }
    if (skillLevel === 0 && skill.bandwidth === 0) zeroSkills += 1;
    else bandwidthUsed += bandwidth;
    quotedSkills.push({
      id: fit.id,
      skill: skill.id,
      label: skill.label,
      specialty,
      level: skillLevel,
      bandwidth,
      effective,
      credits,
    });
    const titled = specialty
      ? `${skill.label} (${specialtyLabel(skill.label, specialty)})`
      : skill.label;
    const name = dm === 0
      ? `${titled} ${skillLevel}`
      : `${titled} ${skillLevel} (effective ${effective})`;
    lines.push({ name, tons: 0, cost: mcr(credits), fold: "brain" });
  }
  const freeZero = baseBandwidth;
  const extraZero = Math.max(0, zeroSkills - freeZero);
  bandwidthUsed += extraZero;
  if (bandwidthUsed > bandwidthAvailable) {
    errors.push(
      `Skill packages use ${bandwidthUsed} bandwidth and the brain has ${bandwidthAvailable}.`,
    );
  }
  if (extraZero > 0) {
    warnings.push(
      `${extraZero} extra level-0 skills use bandwidth. The brain includes ${freeZero} at no bandwidth.`,
    );
  }

  return {
    lines,
    errors,
    warnings,
    slotsUsed,
    slotsAvailable,
    bandwidthUsed,
    bandwidthAvailable,
    protection: armour.protection,
    intellect,
    skillDm,
    dexterity,
    dexDm,
    builtIn,
    skills: quotedSkills,
  };
}

export function armourLimits(techLevel: number): { base: number; max: number } {
  const band = armourBand(techLevel);
  return { base: band.base, max: band.max };
}

export function chassisBaseSlots(size: number): number {
  return chassisOf(Math.min(6, Math.max(1, whole(size, 1)))).slots;
}

export const BRAIN_PROGRAMS = PROGRAMS;
export const BRAIN_UPGRADES = UPGRADES;
export const BRAIN_OPTIONS = OPTIONS;
export const BRAIN_SKILLS = SKILLS;

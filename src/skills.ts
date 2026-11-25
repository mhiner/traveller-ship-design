const SPECIALTIES: Record<string, string[]> = {
  Animals: ["handling", "veterinary", "training"],
  Art: ["performer", "holography", "instrument", "visual", "write"],
  Athletics: ["dexterity", "endurance", "strength"],
  Drive: ["hovercraft", "mole", "track", "walker", "wheel"],
  Electronics: ["comms", "computers", "remote ops", "sensors"],
  Engineer: ["j-drive", "m-drive", "life support", "power"],
  Flyer: ["airship", "grav", "rotor", "wing"],
  "Gun Combat": ["archaic", "energy", "slug"],
  Gunner: ["turret", "ortillery", "screen", "capital"],
  "Heavy Weapons": ["artillery", "man portable", "vehicle"],
  Language: ["Galanglic", "Vilani", "Zdetl", "Oynprith", "Trokh", "Gvegh"],
  Melee: ["unarmed", "blade", "bludgeon", "natural"],
  Pilot: ["small craft", "spacecraft", "capital ships"],
  Profession: ["belter", "chef", "civil engineering", "law"],
  Science: [
    "Astronomy",
    "Biology",
    "Chemistry",
    "Cosmology",
    "Cybernetics",
    "Economics",
    "Genetics",
    "History",
    "Linguistics",
    "Philosophy",
    "Physics",
    "Planetology",
    "Psionicology",
    "Psychology",
    "Robotics",
    "Sophontology",
    "Xenology",
  ],
  Seafarer: ["ocean ships", "personal", "sail", "submarine"],
  Tactics: ["military", "naval"],
};

const ATHLETICS: Record<string, string> = {
  dexterity: "DEX",
  endurance: "END",
  strength: "STR",
};

export function skillSpecialties(name: string): readonly string[] {
  return SPECIALTIES[name] ?? [];
}

export function specialtyLabel(name: string, specialty: string): string {
  return name === "Athletics" ? ATHLETICS[specialty] ?? specialty : specialty;
}

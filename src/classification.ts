export const SHIP_CLASSIFICATIONS = [
  "Free Trader",
  "Lab Ship",
  "Scout",
  "Yacht",
  "Other",
] as const;

export type ShipClassification = (typeof SHIP_CLASSIFICATIONS)[number];

export function credits(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}Cr${Math.abs(rounded).toLocaleString("en-US")}`;
}

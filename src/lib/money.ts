const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 777600 -> "₹7,776.00" */
export function formatPaise(paise: number): string {
  return inr.format(paise / 100);
}

/** Basis points to percent text: 300 -> "3%", 1250 -> "12.5%" */
export function formatBp(bp: number): string {
  return `${bp / 100}%`;
}

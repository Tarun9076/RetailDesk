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

/**
 * 144000 -> "₹1,440", 75840 -> "₹758.40". Whole rupees lose the ".00" so a price reads at a glance;
 * anything with paise keeps both digits. Totals and bills always use formatPaise.
 */
export function formatPriceShort(paise: number): string {
  return paise % 100 === 0
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100)
    : inr.format(paise / 100);
}

/** Basis points to percent text: 300 -> "3%", 1250 -> "12.5%" */
export function formatBp(bp: number): string {
  return `${bp / 100}%`;
}

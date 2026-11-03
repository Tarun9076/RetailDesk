import { formatPaise } from "@/lib/money";

export interface CreditCheck {
  hold: boolean;
  reason: string | null;
  availablePaise: number;
}

/**
 * An order is held for the desk when outstanding + this order would exceed the
 * retailer's credit limit. Exactly reaching the limit is allowed.
 */
export function checkCredit(
  creditLimitPaise: number,
  outstandingPaise: number,
  orderTotalPaise: number,
): CreditCheck {
  const availablePaise = creditLimitPaise - outstandingPaise;
  const over = orderTotalPaise - availablePaise;
  if (over > 0) {
    return {
      hold: true,
      reason: `Exceeds credit limit by ${formatPaise(over)}`,
      availablePaise,
    };
  }
  return { hold: false, reason: null, availablePaise };
}

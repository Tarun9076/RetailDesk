// All amounts are integer paise. Unit prices are per piece, quantities are whole cases.

export type SchemeRule =
  | {
      type: "FREE_GOODS";
      buyQty: number;
      freeQty: number;
      label: string;
      active?: boolean;
      validFrom?: Date | null;
      validUntil?: Date | null;
    }
  | {
      type: "SLAB_PERCENT";
      minQty: number;
      percentBp: number; // 300 = 3%
      label: string;
      active?: boolean;
      validFrom?: Date | null;
      validUntil?: Date | null;
    };

export interface PricingLineInput {
  skuId: string;
  qtyCases: number;
  unitPricePaise: number; // per piece, GST-exclusive
  piecesPerCase: number;
  gstRateBp: number; // 1200 = 12%
  stockCases: number;
  /**
   * Every scheme on this product, or one, or none. The engine applies the single
   * best one for the quantity ordered; schemes never stack.
   */
  scheme?: SchemeRule | SchemeRule[] | null;
}

export type LineIssue =
  | { code: "OUT_OF_STOCK" }
  | { code: "INSUFFICIENT_STOCK"; availableCases: number; maxOrderableCases: number };

/** What the retailer unlocks by adding `needCases` more cases of this item. */
export type NextBenefit =
  | { kind: "FREE_GOODS"; needCases: number; freeCases: number }
  | { kind: "SLAB_PERCENT"; needCases: number; percentBp: number };

export interface PricedLine {
  skuId: string;
  qtyCases: number; // cases paid for
  freeCases: number; // extra cases given free
  grossPaise: number; // qtyCases x case price
  discountPaise: number;
  taxablePaise: number; // gross - discount
  gstPaise: number;
  totalPaise: number; // taxable + gst
  schemeLabel: string | null; // scheme that actually applied
  appliedScheme: SchemeRule | null; // the same scheme as a rule, so the UI can word it in either language
  hint: string | null; // English text for the next benefit (logs, tests)
  nextBenefit: NextBenefit | null; // same thing as data, for translated UI
  issue: LineIssue | null;
}

export interface PricedOrder {
  lines: PricedLine[];
  subtotalPaise: number; // sum of gross
  discountPaise: number;
  gstPaise: number;
  totalPaise: number;
  hasIssues: boolean;
}

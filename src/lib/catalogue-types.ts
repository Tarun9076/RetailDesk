// Client-safe: no database or server-only imports, so components can use it.
import type { SchemeRule } from "@/lib/pricing/types";

/** Cases at or below which we tell the retailer stock is running low. */
export const LOW_STOCK_CASES = 20;

export interface CatalogueItem {
  id: string;
  code: string;
  name: string;
  nameHi: string | null;
  brand: string;
  piecesPerCase: number;
  unitPricePaise: number; // this retailer's price per piece, GST-exclusive
  casePricePaise: number;
  gstRateBp: number;
  stockCases: number;
  /** The desk's photo of the product (an https address), or null: a drawn pack is shown instead. */
  imageUrl: string | null;
  schemes: SchemeRule[]; // currently live schemes only, without dates; the engine applies the best one
}

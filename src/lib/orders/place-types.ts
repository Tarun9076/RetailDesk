// Client-safe types shared by the order API and the salesman's phone.

/** What the server actually charged for one line, so a phone can show what changed since it priced the order. */
export interface PlacedLine {
  skuId: string;
  qtyCases: number;
  freeCases: number;
  totalPaise: number;
}

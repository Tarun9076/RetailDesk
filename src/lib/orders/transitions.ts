export type OrderStatusName = "PLACED" | "ON_HOLD" | "CONFIRMED" | "EXPORTED" | "CANCELLED";
export type DeskAction = "CONFIRM" | "RELEASE" | "CANCEL";

/**
 * The only moves the desk can make:
 *   PLACED    --CONFIRM--> CONFIRMED   (normal check)
 *   ON_HOLD   --RELEASE--> CONFIRMED   (desk accepts the credit risk)
 *   any open  --CANCEL---> CANCELLED   (stock goes back)
 * Exported and cancelled orders are final: they already left for Tally, or are dead.
 */
const MOVES: Record<DeskAction, { from: OrderStatusName[]; to: OrderStatusName }> = {
  CONFIRM: { from: ["PLACED"], to: "CONFIRMED" },
  RELEASE: { from: ["ON_HOLD"], to: "CONFIRMED" },
  CANCEL: { from: ["PLACED", "ON_HOLD", "CONFIRMED"], to: "CANCELLED" },
};

export function nextStatus(current: OrderStatusName, action: DeskAction): OrderStatusName | null {
  const move = MOVES[action];
  return move.from.includes(current) ? move.to : null;
}

export function allowedActions(current: OrderStatusName): DeskAction[] {
  return (Object.keys(MOVES) as DeskAction[]).filter((a) => MOVES[a].from.includes(current));
}

export function statesAllowing(action: DeskAction): OrderStatusName[] {
  return MOVES[action].from;
}

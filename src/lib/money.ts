export function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export const LEDGER_TYPES = [
  { key: "BUY_IN", label: "Buy-in owed", direction: -1, help: "Player owes this to the pot" },
  { key: "PAYMENT", label: "Payment received", direction: 1, help: "Player paid money toward the pot" },
  { key: "PAYOUT", label: "Payout", direction: 1, help: "Winnings owed/paid to the player" },
  { key: "ADJUSTMENT", label: "Adjustment", direction: 1, help: "Manual correction" },
] as const;

export type LedgerType = (typeof LEDGER_TYPES)[number]["key"];

/**
 * Balance convention (from the player's perspective):
 *  - BUY_IN of $50    -> balance -50 (they owe the pot $50)
 *  - PAYMENT of $50   -> balance +50 (they settled up)
 *  - PAYOUT of $120   -> recorded when winnings are PAID OUT to the player; informational for pot math
 *  - ADJUSTMENT       -> signed amount applied directly
 * A player is "settled" when balance >= 0.
 */
export function entrySignedAmount(type: string, amountCents: number): number {
  switch (type) {
    case "BUY_IN":
      return -Math.abs(amountCents);
    case "PAYMENT":
      return Math.abs(amountCents);
    case "PAYOUT":
      return 0; // payouts don't offset what a player owes the pot
    default:
      return amountCents;
  }
}

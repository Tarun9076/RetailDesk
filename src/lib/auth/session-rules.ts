/**
 * A login (a signed cookie) is valid for its whole lifetime unless the account says "nothing issued
 * before this moment counts". That moment is set when a password is changed or reset, when staff are
 * switched off, or a shop's number changes, so an old cookie on a lost laptop stops working at once.
 *
 * Both times are exact to the millisecond. A login with no recorded time at all is treated as old.
 */
export function isSessionRevoked(validFrom: Date | null | undefined, issuedAtMs: number | undefined): boolean {
  if (!validFrom) return false;
  return (issuedAtMs ?? 0) < validFrom.getTime();
}

/** The moment from which only newer logins count. */
export function revocationCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime());
}

/**
 * When to stamp a new login made right after a revocation (the person who has just changed their own
 * password stays signed in). It is never earlier than the cut-off, even if this server's clock runs a few
 * milliseconds behind the one that set it.
 */
export function issuedAfter(cutoff: Date, now: Date = new Date()): Date {
  return new Date(Math.max(now.getTime(), cutoff.getTime() + 1));
}

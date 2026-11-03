import { SignJWT, jwtVerify } from "jose";

export type Role = "RETAILER" | "DESK";

export interface SessionPayload {
  sub: string; // user id
  role: Role;
  retailerId: string | null;
}

/** Desk staff sit at shared office PCs, so their sessions are short. */
export const SESSION_TTL_SECONDS: Record<Role, number> = {
  RETAILER: 30 * 24 * 3600,
  DESK: 12 * 3600,
};

const key = (secret: string) => new TextEncoder().encode(secret);

export async function signSession(
  payload: SessionPayload,
  secret: string,
  now: Date = new Date(),
): Promise<string> {
  if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({ role: payload.role, retailerId: payload.retailerId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt(iat)
    .setExpirationTime(iat + SESSION_TTL_SECONDS[payload.role])
    .sign(key(secret));
}

export async function verifySession(
  token: string,
  secret: string,
  now: Date = new Date(),
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      algorithms: ["HS256"],
      currentDate: now,
    });
    const role = payload.role;
    if (typeof payload.sub !== "string" || (role !== "RETAILER" && role !== "DESK")) return null;
    return {
      sub: payload.sub,
      role,
      retailerId: typeof payload.retailerId === "string" ? payload.retailerId : null,
    };
  } catch {
    return null;
  }
}

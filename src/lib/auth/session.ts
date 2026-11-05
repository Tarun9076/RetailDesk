import { cookies } from "next/headers";
import { sessionSecret } from "./env";
import {
  SESSION_TTL_SECONDS,
  signSession,
  verifySession,
  type SessionPayload,
} from "./session-token";

export const SESSION_COOKIE = "rd_session";

export async function createSession(payload: SessionPayload, issuedAt: Date = new Date()) {
  const token = await signSession(payload, sessionSecret(), issuedAt);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS[payload.role],
  });
}

export async function readSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifySession(token, sessionSecret()) : null;
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

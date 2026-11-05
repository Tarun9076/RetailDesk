/**
 * Break-glass: sets a desk password from the command line, for when everyone is locked out.
 * Normal resets are done by a colleague on the Staff screen.
 *
 *   DESK_EMAIL=desk@retaildesk.demo DESK_NEW_PASSWORD='something-long-9' npm run desk:reset
 *
 * The password comes from an environment variable, not an argument, so it does not
 * end up in the shell history or the process list. The person must choose their own
 * password at the next sign-in, and every existing login of theirs is ended.
 */
import "dotenv/config";
import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { validateNewPassword } from "../src/lib/auth/password-rules";

async function main() {
  const email = process.env.DESK_EMAIL?.trim().toLowerCase();
  const password = process.env.DESK_NEW_PASSWORD;
  if (!email || !password) throw new Error("Set DESK_EMAIL and DESK_NEW_PASSWORD first.");
  const problem = validateNewPassword(password, { email });
  if (problem) throw new Error(`That password is not acceptable: ${problem}`);

  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL (or DIRECT_URL) first.");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const user = await db.user.findFirst({ where: { role: "DESK", email } });
    if (!user) throw new Error(`No desk account with the email ${email}.`);
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await argon2.hash(password),
          active: true,
          mustChangePassword: true,
          sessionsValidFrom: new Date(Math.floor(Date.now() / 1000) * 1000),
        },
      }),
      db.staffEvent.create({
        data: { userId: user.id, kind: "PASSWORD_RESET", summary: "Password set from the command line (break-glass reset)", byName: "Command line" },
      }),
      // A locked-out account may also be rate-limited; clear that so the new password can be used straight away.
      db.rateLimitHit.deleteMany({ where: { key: { startsWith: `desk:email:${email}` } } }),
    ]);
    console.log(`Done. ${email} can sign in with the new password, and will be asked to choose their own.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

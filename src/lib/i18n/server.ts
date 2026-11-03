import "server-only";
import { cookies } from "next/headers";
import { LANG_COOKIE, dictionaries, type Lang } from "./dict";

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return v === "hi" ? "hi" : "en";
}

export async function getDict() {
  const lang = await getLang();
  return { lang, t: dictionaries[lang] };
}

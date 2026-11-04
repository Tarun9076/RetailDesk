import { describe, expect, it } from "vitest";
import { timeAgo } from "@/lib/field/ago";
import { fieldDictionaries } from "./field";

const en = fieldDictionaries.en as Record<string, string>;
const hi = fieldDictionaries.hi as Record<string, string>;
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const DEVANAGARI = /[ऀ-ॿ]/;

describe("salesman screens in Hindi", () => {
  it("has every sentence in both languages, none empty", () => {
    expect(Object.keys(hi).sort()).toEqual(Object.keys(en).sort());
    for (const [k, v] of Object.entries(hi)) expect(v.trim().length, k).toBeGreaterThan(0);
  });

  it("uses exactly the same {placeholders} as the English, so no number or name goes missing", () => {
    for (const k of Object.keys(en)) expect(placeholders(hi[k]), k).toEqual(placeholders(en[k]));
  });

  it("is really Hindi: nearly every sentence contains Devanagari", () => {
    // Only a handful of items are international words that legitimately stay as they are (for example GST).
    const latinOnly = Object.entries(hi).filter(([, v]) => !DEVANAGARI.test(v)).map(([k]) => k);
    expect(latinOnly).toEqual(["gst"]);
  });

  it("does not leave English sentences behind in Hindi", () => {
    for (const [k, v] of Object.entries(hi)) {
      if (k === "gst") continue;
      expect(v, k).not.toBe(en[k]);
    }
  });
});

describe("time words follow the language", () => {
  const now = new Date("2026-11-05T12:00:00Z");
  const ago = (mins: number) => new Date(now.getTime() - mins * 60_000).toISOString();
  it("in English by default", () => {
    expect(timeAgo(ago(0), now)).toBe("just now");
    expect(timeAgo(ago(12), now)).toBe("12 min ago");
    expect(timeAgo(ago(180), now)).toBe("3 h ago");
    expect(timeAgo(ago(60 * 24), now)).toBe("1 day ago");
    expect(timeAgo(ago(60 * 24 * 3), now)).toBe("3 days ago");
    expect(timeAgo(null, now)).toBe("never");
  });
  it("in Hindi when given the Hindi words", () => {
    const f = fieldDictionaries.hi;
    expect(timeAgo(ago(0), now, f)).toBe("अभी-अभी");
    expect(timeAgo(ago(12), now, f)).toBe("12 मिनट पहले");
    expect(timeAgo(ago(180), now, f)).toBe("3 घंटे पहले");
    expect(timeAgo(ago(60 * 24 * 3), now, f)).toBe("3 दिन पहले");
  });
});

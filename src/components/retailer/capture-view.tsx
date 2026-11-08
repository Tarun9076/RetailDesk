"use client";

import { Camera, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, ErrorNote } from "@/components/ui";
import { shrinkPhoto } from "@/lib/capture/shrink";
import type { CaptureLineDto, CaptureSource, ConfidenceLevel } from "@/lib/capture/types";
import { fmt, type Dict } from "@/lib/i18n/dict";
import { maxOrderableCases } from "@/lib/pricing/engine";
import { useCart } from "./cart-provider";
import { QtyStepper } from "./qty-stepper";

type Unit = "case" | "piece" | "unknown";

interface LineState {
  dto: CaptureLineDto;
  removed: boolean;
  skuId: string | null;
  unit: Unit;
  qty: number | null;
}

const EXAMPLES = [
  "bhaiya 5 peti biscuit chhota, 2 peti washing powder 1 kilo, chai patti 250 wala 1 peti",
  "५ पेटी बिस्कुट, 2 पेटी डिटर्जेंट पाउडर 1 किलो, चाय पत्ती 250 ग्राम 1 पेटी",
];

const LEVEL_STYLE: Record<ConfidenceLevel, string> = {
  high: "bg-accent-soft text-accent",
  medium: "bg-amber-100 text-amber-900",
  low: "bg-danger-soft text-danger",
};

export function CaptureView({ t }: { t: Dict["capture"] }) {
  const router = useRouter();
  const { items, lang, addMany, setCaptureId } = useCart();
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const nameOf = (id: string) => {
    const i = byId.get(id);
    return i ? (lang === "hi" && i.nameHi ? i.nameHi : i.name) : "";
  };

  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"input" | "reading" | "review">("input");
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captureId, setId] = useState<string | null>(null);
  const [source, setSource] = useState<CaptureSource>("ai");
  const [lines, setLines] = useState<LineState[]>([]);
  const [saving, setSaving] = useState(false);
  const [fromPhoto, setFromPhoto] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (slowTimer.current && clearTimeout(slowTimer.current)), []);

  /** The shopkeeper chose a picture: shrink it here, then send it for reading. */
  async function readPhoto(file: File) {
    setError(null);
    let blob: Blob;
    try {
      blob = await shrinkPhoto(file);
    } catch {
      setError(t.errors.photoPrepare);
      return;
    }
    const body = new FormData();
    body.append("photo", blob, "list.jpg");
    await read({ method: "POST", body }, true);
  }

  async function read(init?: RequestInit, photo = false) {
    setError(null);
    setSlow(false);
    setFromPhoto(photo);
    setPhase("reading");
    slowTimer.current = setTimeout(() => setSlow(true), 4000);
    try {
      const res = await fetch(
        "/api/capture",
        init ?? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        captureId?: string;
        source?: CaptureSource;
        lines?: CaptureLineDto[];
        retryAfterSec?: number;
        error?: string;
      };
      if (!res.ok || !data.captureId || !data.lines) {
        setError(
          data.error === "rate_limited"
            ? fmt(t.errors.rateLimited, { s: data.retryAfterSec ?? 60 })
            : photo
              ? t.errors.photo
              : t.errors.failed,
        );
        setPhase("input");
        return;
      }
      setId(data.captureId);
      setSource(data.source ?? "basic");
      setLines(
        data.lines.map((dto) => ({ dto, removed: false, skuId: dto.skuId, unit: dto.unit, qty: dto.qty })),
      );
      setPhase("review");
    } catch {
      setError(t.errors.network);
      setPhase("input");
    } finally {
      if (slowTimer.current) clearTimeout(slowTimer.current);
    }
  }

  const patch = (index: number, change: Partial<LineState>) =>
    setLines((ls) => ls.map((l) => (l.dto.index === index ? { ...l, ...change } : l)));

  /** Everything the screen needs to know about one line, derived from what the shopkeeper chose. */
  function status(l: LineState) {
    const item = l.skuId ? byId.get(l.skuId) : undefined;
    const out = !!item && item.stockCases === 0;
    const max = item ? maxOrderableCases(item.stockCases, item.schemes) : 0;
    let cases: number | null = null;
    if (l.qty && l.qty > 0) {
      if (l.unit === "case") cases = l.qty;
      else if (l.unit === "piece" && item) cases = Math.ceil(l.qty / item.piecesPerCase);
    }
    const reduced = !!cases && max > 0 && cases > max;
    const effective = cases && max > 0 ? Math.min(cases, max) : cases;
    const problem: "choose" | "oos" | "unit" | "qty" | null = !item
      ? "choose"
      : out
        ? "oos"
        : l.unit === "unknown"
          ? "unit"
          : !effective
            ? "qty"
            : null;
    return { item, out, max, cases, effective, reduced, problem };
  }

  const active = lines.filter((l) => !l.removed);
  const statuses = new Map(active.map((l) => [l.dto.index, status(l)]));
  const blockers = active.filter((l) => statuses.get(l.dto.index)!.problem !== null).length;
  const ready = active.length - blockers;

  async function addToCart() {
    if (!captureId) return;
    setError(null);
    setSaving(true);
    const chosen = active.map((l) => ({
      index: l.dto.index,
      skuId: l.skuId!,
      qtyCases: statuses.get(l.dto.index)!.effective!,
    }));
    try {
      const res = await fetch(`/api/capture/${captureId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: chosen }),
      });
      if (!res.ok) {
        setError(t.errors.confirm);
        setSaving(false);
        return;
      }
      const add: Record<string, number> = {};
      for (const c of chosen) add[c.skuId] = (add[c.skuId] ?? 0) + c.qtyCases;
      addMany(add);
      setCaptureId(captureId);
      router.push("/cart");
    } catch {
      setError(t.errors.network);
      setSaving(false);
    }
  }

  function startAgain() {
    setPhase("input");
    setLines([]);
    setId(null);
    setError(null);
  }

  if (phase === "reading") {
    const reading = fromPhoto ? t.photoReading : t.reading;
    return (
      <div className="flex flex-col items-center py-20 text-center" aria-live="polite">
        <Sparkles size={36} aria-hidden className="animate-pulse text-accent" />
        <p className="mt-4 font-medium">{reading}</p>
        {slow && <p className="mt-1 text-sm text-muted">{t.readingSlow}</p>}
      </div>
    );
  }

  if (phase === "input") {
    return (
      <div className="mx-auto max-w-2xl lg:max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="mt-2 text-muted">{t.intro}</p>

        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = ""; // so the same photo can be chosen again
            if (f) void readPhoto(f);
          }}
        />
        <button
          type="button"
          onClick={() => photoInput.current?.click()}
          className="mt-4 flex min-h-16 w-full items-center gap-3 rounded-2xl border border-accent px-4 text-left text-accent hover:bg-accent-soft"
        >
          <Camera size={24} aria-hidden className="shrink-0" />
          <span>
            <span className="block text-base font-medium">{t.photo}</span>
            <span className="block text-sm text-muted">{t.photoHint}</span>
          </span>
        </button>
        <p className="mt-5 text-center text-sm text-muted">{t.or}</p>

        <label htmlFor="msg" className="sr-only">
          {t.title}
        </label>
        <textarea
          id="msg"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 1500))}
          rows={7}
          lang={lang}
          placeholder={t.placeholder}
          className="mt-2 w-full rounded-xl border border-line bg-bg px-4 py-3 text-base placeholder:text-muted/60 focus:border-accent"
        />
        <div className="mt-1 flex items-center justify-between text-xs text-muted">
          <span>{text.length}/1500</span>
        </div>

        <div className="mt-3">
          <p className="mb-2 text-sm text-muted">{t.example}</p>
          <div className="flex flex-col gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setText(ex)}
                className="min-h-12 rounded-xl border border-line px-4 py-2 text-left text-sm text-muted hover:bg-surface"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mt-4">
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}
        <div className="mt-5">
          <Button type="button" disabled={text.trim().length < 2} onClick={() => read()}>
            {t.read}
          </Button>
        </div>
      </div>
    );
  }

  // review
  return (
    <div className="mx-auto max-w-2xl pb-24 md:max-w-4xl lg:max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
      <p
        className={`mt-3 flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${
          source === "ai" && !fromPhoto ? "bg-accent-soft text-accent-strong" : "bg-amber-50 text-amber-900"
        }`}
      >
        {source === "ai" && !fromPhoto ? <Sparkles size={18} aria-hidden className="mt-0.5 shrink-0" /> : <TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0" />}
        {fromPhoto ? t.photoNotice : source === "ai" ? t.aiNotice : t.basicNotice}
      </p>

      {lines.length === 0 || active.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted">{lines.length === 0 ? (fromPhoto ? t.noLinesPhoto : t.noLines) : t.allRemoved}</p>
          <div className="mt-5 max-w-xs mx-auto">
            <Button type="button" onClick={startAgain}>
              {t.again}
            </Button>
          </div>
        </div>
      ) : (
        // Each reviewed line is a card: one per row on a phone, two side by side on a tablet or laptop.
        <ul className="mt-4 space-y-3 md:grid md:grid-cols-2 md:items-start md:gap-4 md:space-y-0">
          {active.map((l) => {
            const s = statuses.get(l.dto.index)!;
            const suggested = [l.dto.skuId, ...l.dto.alternatives.map((a) => a.skuId)].filter(
              (x): x is string => !!x,
            );
            const others = items.filter((i) => !suggested.includes(i.id));
            const opt = (id: string) => {
              const it = byId.get(id)!;
              return (
                <option key={id} value={id} disabled={it.stockCases === 0 && id !== l.skuId}>
                  {nameOf(id)}
                  {it.stockCases === 0 ? ` (${t.oosShort})` : ""}
                </option>
              );
            };
            const level = l.skuId === l.dto.skuId ? l.dto.level : "medium";
            return (
              <li key={l.dto.index} className="rounded-2xl border border-line p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted">{t.youWrote}</p>
                    <p className="font-medium leading-snug">“{l.dto.original}”</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${LEVEL_STYLE[level]}`}>
                    {level === "high" ? t.sure : level === "medium" ? t.check : t.notSure}
                  </span>
                </div>

                <label htmlFor={`p-${l.dto.index}`} className="mb-1 mt-3 block text-xs text-muted">
                  {t.product}
                </label>
                <select
                  id={`p-${l.dto.index}`}
                  value={l.skuId ?? ""}
                  onChange={(e) => patch(l.dto.index, { skuId: e.target.value || null })}
                  className="min-h-14 w-full rounded-xl border border-line bg-bg px-3 text-base focus:border-accent"
                >
                  <option value="" disabled>
                    {t.choose}
                  </option>
                  {suggested.length > 0 && <optgroup label={t.alsoLikely}>{suggested.map(opt)}</optgroup>}
                  <optgroup label={t.otherProducts}>{others.map((i) => opt(i.id))}</optgroup>
                </select>

                {l.dto.reason === "learned" && l.skuId === l.dto.skuId && (
                  <p className="mt-1.5 text-xs text-accent">{t.learned}</p>
                )}

                {s.problem === "oos" && (
                  <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm text-danger">
                    <TriangleAlert size={16} aria-hidden className="mt-0.5 shrink-0" />
                    {t.outOfStock}
                  </p>
                )}

                {l.unit === "unknown" && s.item && !s.out && (
                  <div className="mt-3 rounded-xl bg-amber-50 p-3">
                    <p className="text-sm font-medium text-amber-900">{t.unitQuestion}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => patch(l.dto.index, { unit: "case" })} className="min-h-12 rounded-xl border border-amber-300 bg-bg px-3 text-sm font-medium hover:bg-amber-100">
                        {t.unitCase}
                      </button>
                      <button type="button" onClick={() => patch(l.dto.index, { unit: "piece" })} className="min-h-12 rounded-xl border border-amber-300 bg-bg px-3 text-sm font-medium hover:bg-amber-100">
                        {t.unitPiece}
                      </button>
                    </div>
                  </div>
                )}

                {s.item && !s.out && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="w-44">
                        <QtyStepper
                          value={l.qty ?? 0}
                          max={l.unit === "piece" ? 100000 : Math.max(s.max, 1)}
                          onChange={(v) => patch(l.dto.index, { qty: v > 0 ? v : null })}
                          label={l.unit === "piece" ? t.unitPiece : t.cases}
                        />
                      </div>
                      <span className="text-sm text-muted">{l.unit === "piece" ? t.unitPiece : t.cases}</span>
                    </div>
                    {s.problem === "qty" && l.unit !== "unknown" && <p className="mt-1.5 text-sm text-amber-800">{t.qtyMissing}</p>}
                    {l.unit === "piece" && s.cases && (
                      <p className="mt-1.5 text-sm text-muted">{fmt(t.piecesToCases, { p: l.qty ?? 0, c: s.cases })}</p>
                    )}
                    {s.reduced && <p className="mt-1.5 text-sm text-amber-800">{fmt(t.reduced, { n: s.effective ?? 0 })}</p>}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => patch(l.dto.index, { removed: true })}
                  className="mt-3 flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm text-muted hover:bg-surface"
                >
                  <Trash2 size={16} aria-hidden />
                  {t.remove}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <div className="mt-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      {active.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl gap-2 md:max-w-4xl lg:max-w-5xl">
            <button type="button" onClick={startAgain} className="min-h-14 shrink-0 rounded-xl border border-line px-4 text-sm font-medium text-muted hover:bg-surface">
              {t.again}
            </button>
            <Button type="button" disabled={blockers > 0 || saving} onClick={addToCart}>
              {blockers > 0 ? fmt(t.fixLines, { n: blockers }) : fmt(t.addToCart, { n: ready })}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

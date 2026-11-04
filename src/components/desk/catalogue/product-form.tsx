"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorNote } from "@/components/ui";
import { GST_RATES_BP, paiseToInput, parseRupees } from "@/lib/catalogue-admin/rules";
import { formatPaise } from "@/lib/money";
import { card, hint, input, label, primaryBtn } from "./styles";

export interface ProductValues {
  id?: string;
  code: string;
  name: string;
  nameHi: string;
  brand: string;
  piecesPerCase: number;
  pricePaise: number | null;
  gstRateBp: number;
  active: boolean;
}

const ERRORS: Record<string, string> = {
  code_taken: "That product code is already used. Pick another.",
};

/** Add a product, or edit one. Stock and schemes have their own panels on the product page. */
export function ProductForm({ mode, initial, brands }: { mode: "create" | "edit"; initial: ProductValues; brands: string[] }) {
  const router = useRouter();
  const [v, setV] = useState({
    code: initial.code,
    name: initial.name,
    nameHi: initial.nameHi,
    brand: initial.brand,
    pieces: initial.piecesPerCase ? String(initial.piecesPerCase) : "",
    price: initial.pricePaise ? paiseToInput(initial.pricePaise) : "",
    gst: String(initial.gstRateBp),
    stock: "0",
    active: initial.active,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setSaved(false);
    setV((p) => ({ ...p, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));
  };

  const pricePaise = parseRupees(v.price);
  const pieces = Number(v.pieces);
  const casePrice = pricePaise !== null && Number.isInteger(pieces) && pieces > 0 ? pricePaise * pieces : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pricePaise === null) return setError("Enter the price per piece in rupees, for example 7.90.");
    if (!Number.isInteger(pieces) || pieces < 1) return setError("Pieces per case must be a whole number, 1 or more.");
    const stock = Number(v.stock || 0);
    if (mode === "create" && (!Number.isInteger(stock) || stock < 0)) return setError("Opening stock must be a whole number of cases.");

    setBusy(true);
    try {
      const common = {
        name: v.name,
        nameHi: v.nameHi.trim() || null,
        brand: v.brand,
        piecesPerCase: pieces,
        pricePaise,
        gstRateBp: Number(v.gst),
      };
      const res =
        mode === "create"
          ? await fetch("/api/desk/products", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...common, code: v.code, stockCases: stock }),
            })
          : await fetch(`/api/desk/products/${initial.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...common, active: v.active }),
            });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (res.ok) {
        if (mode === "create" && data.id) {
          router.push(`/desk/catalogue/${data.id}?added=1`);
        } else {
          setSaved(true);
          router.refresh();
        }
        router.refresh();
        setBusy(false);
        return;
      }
      setError(ERRORS[data.error ?? ""] ?? "Could not save. Check the details and try again.");
    } catch {
      setError("No connection. Try again.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className={card} aria-labelledby="details-title">
      <h2 id="details-title" className="text-lg font-semibold">
        {mode === "create" ? "Product details" : "Details and price"}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="code" className={label}>Product code</label>
          <input
            id="code"
            value={v.code}
            onChange={set("code")}
            disabled={mode === "edit"}
            required
            placeholder="SKU-RC-1KG"
            className={`${input} uppercase`}
          />
          <p className={hint}>{mode === "edit" ? "The code cannot change once orders may use it." : "Capital letters, digits and dashes. Must be new."}</p>
        </div>
        <div>
          <label htmlFor="brand" className={label}>Brand</label>
          <input id="brand" list="brands" value={v.brand} onChange={set("brand")} required maxLength={80} className={input} />
          <datalist id="brands">
            {brands.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="name" className={label}>Name (English)</label>
          <input id="name" value={v.name} onChange={set("name")} required maxLength={120} placeholder="Basmati rice 1 kg, case of 10" className={input} />
        </div>
        <div>
          <label htmlFor="nameHi" className={label}>Name in Hindi (optional)</label>
          <input id="nameHi" lang="hi" value={v.nameHi} onChange={set("nameHi")} maxLength={120} className={input} />
          <p className={hint}>Shown to shopkeepers who choose Hindi.</p>
        </div>
        <div>
          <label htmlFor="price" className={label}>Dealer price per piece (₹, GST extra)</label>
          <input id="price" inputMode="decimal" value={v.price} onChange={set("price")} required placeholder="7.90" className={input} />
        </div>
        <div>
          <label htmlFor="pieces" className={label}>Pieces in one case</label>
          <input id="pieces" inputMode="numeric" value={v.pieces} onChange={set("pieces")} required placeholder="96" className={input} />
          <p className={hint}>
            {casePrice !== null ? `A case costs ${formatPaise(casePrice)} before GST.` : "Shopkeepers order whole cases."}
          </p>
        </div>
        <div>
          <label htmlFor="gst" className={label}>GST rate</label>
          <select id="gst" value={v.gst} onChange={set("gst")} className={input}>
            {GST_RATES_BP.map((bp) => (
              <option key={bp} value={bp}>
                {bp === 0 ? "0% (no GST)" : `${bp / 100}%`}
              </option>
            ))}
          </select>
        </div>
        {mode === "create" ? (
          <div>
            <label htmlFor="stock" className={label}>Opening stock (cases)</label>
            <input id="stock" inputMode="numeric" value={v.stock} onChange={set("stock")} className={input} />
          </div>
        ) : (
          <div className="flex items-end">
            <label className="flex min-h-12 cursor-pointer items-center gap-3 text-base">
              <input type="checkbox" checked={v.active} onChange={set("active")} className="h-5 w-5 accent-[#1b6b47]" />
              On sale
            </label>
          </div>
        )}
      </div>
      {mode === "edit" && !v.active && (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Off sale: shopkeepers and salesmen no longer see this product. Past orders are not affected.
        </p>
      )}
      {error && (
        <div className="mt-4">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy ? "Saving…" : mode === "create" ? "Add product" : "Save changes"}
        </button>
        {saved && (
          <span role="status" className="text-sm font-medium text-accent">
            Saved. New prices apply to the next order.
          </span>
        )}
      </div>
    </form>
  );
}

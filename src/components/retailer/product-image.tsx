const TINTS: Record<string, { bg: string; fg: string }> = {
  "Annapurna Foods": { bg: "#fbf1dc", fg: "#8a5a00" },
  "Chaikhana Teas": { bg: "#e7f2ec", fg: "#1b6b47" },
  SafaiPlus: { bg: "#e6f0fa", fg: "#1f5a99" },
  "Nirmal Care": { bg: "#fbe9f1", fg: "#a3275f" },
};
const FALLBACK = { bg: "#eef1ef", fg: "#4b5a52" };

/**
 * A pack-style tile built from the SKU's own name, so it needs no image
 * download (kind to slow 3G). Real product photos can replace it later.
 */
export function ProductImage({ name, brand, dim }: { name: string; brand: string; dim?: boolean }) {
  const tint = TINTS[brand] ?? FALLBACK;
  const size = name.match(/(\d+(?:\.\d+)?)\s?(kg|g|ml|l)\b/i);
  const title = name.split(/\d/)[0].replace(/[,\s]+$/, "");
  return (
    <div
      aria-hidden
      className={`flex aspect-square w-full flex-col items-center justify-center rounded-xl p-3 text-center ${dim ? "opacity-40 grayscale" : ""}`}
      style={{ background: tint.bg, color: tint.fg }}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide opacity-80">{brand}</span>
      <span className="mt-1 text-4xl font-semibold leading-none">
        {size ? size[1] : title.slice(0, 2)}
        {size && <span className="ml-1 text-lg font-medium">{size[2].toLowerCase()}</span>}
      </span>
      <span className="mt-2 line-clamp-1 text-xs opacity-80">{title}</span>
    </div>
  );
}

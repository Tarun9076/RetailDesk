import { packColourFor, packKindFor, packLabelFor, packSizeFrom, type PackKind } from "@/lib/product-look";

/**
 * A drawn pack, built from the product's own name and brand, so it costs no download (kind to slow 3G)
 * and a new product looks right the moment it is added. A real photo, when the desk adds one, replaces it.
 */
export function ProductArt({ name, brand }: { name: string; brand: string }) {
  const kind = packKindFor(name);
  const colour = packColourFor(brand, name);
  const size = packSizeFrom(name);
  const label = packLabelFor(brand);
  return (
    // The box is cropped close around the pack, so it fills the picture instead of floating in it.
    <svg viewBox="26 22 148 156" role="presentation" aria-hidden className="h-full w-full" focusable="false">
      {/* a soft floor shadow grounds the pack */}
      <ellipse cx="100" cy="176" rx="52" ry="6" fill="#15211b" opacity="0.07" />
      <Pack kind={kind} colour={colour} size={size} label={label} />
    </svg>
  );
}

function Pack({ kind, colour, size, label }: { kind: PackKind; colour: string; size: string | null; label: string }) {
  const sizeText = (x: number, y: number, fill: string) =>
    size && (
      <text x={x} y={y} textAnchor="middle" fontSize="26" fontWeight="700" fill={fill} style={{ fontFamily: "inherit" }}>
        {size}
      </text>
    );
  const brandText = (x: number, y: number, fill: string) => (
    <text x={x} y={y} textAnchor="middle" fontSize="9" fontWeight="600" letterSpacing="0.8" fill={fill} opacity="0.9" style={{ fontFamily: "inherit" }}>
      {label}
    </text>
  );

  switch (kind) {
    case "pouch":
      return (
        <g>
          <path d="M56 46 H144 L141 60 Q150 108 141 152 L144 166 H56 L59 152 Q50 108 59 60 Z" fill={colour} />
          <path d="M56 46 H144 L142 54 H58 Z" fill="#000" opacity="0.14" />
          <path d="M59 158 H141" stroke="#fff" strokeOpacity="0.25" strokeWidth="1.5" />
          <rect x="66" y="88" width="68" height="46" rx="8" fill="#fff" opacity="0.14" />
          {brandText(100, 102, "#fff")}
          {sizeText(100, 126, "#fff")}
        </g>
      );
    case "bottle":
      return (
        <g>
          <rect x="86" y="28" width="28" height="18" rx="4" fill={colour} opacity="0.85" />
          <rect x="90" y="46" width="20" height="16" fill={colour} opacity="0.7" />
          <rect x="64" y="60" width="72" height="108" rx="16" fill={colour} />
          <rect x="64" y="60" width="72" height="108" rx="16" fill="#fff" opacity="0.08" />
          <rect x="64" y="92" width="72" height="50" fill="#fff" />
          {brandText(100, 108, colour)}
          {sizeText(100, 132, colour)}
        </g>
      );
    case "tub":
      return (
        <g>
          <rect x="50" y="62" width="100" height="106" rx="10" fill={colour} />
          <rect x="50" y="62" width="100" height="20" rx="10" fill="#000" opacity="0.16" />
          <rect x="76" y="48" width="48" height="16" rx="6" fill={colour} opacity="0.8" />
          <rect x="62" y="96" width="76" height="52" rx="8" fill="#fff" />
          {brandText(100, 112, colour)}
          {sizeText(100, 137, colour)}
        </g>
      );
    case "bar":
      return (
        <g>
          <rect x="42" y="82" width="116" height="68" rx="24" fill={colour} />
          <rect x="52" y="92" width="96" height="48" rx="16" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" />
          {brandText(100, 112, "#fff")}
          {sizeText(100, 134, "#fff")}
        </g>
      );
    default:
      return (
        <g>
          <path d="M52 62 H148 L138 44 H62 Z" fill={colour} opacity="0.75" />
          <rect x="52" y="62" width="96" height="104" rx="6" fill={colour} />
          <rect x="52" y="96" width="96" height="44" fill="#fff" opacity="0.14" />
          {brandText(100, 112, "#fff")}
          {sizeText(100, 134, "#fff")}
        </g>
      );
  }
}

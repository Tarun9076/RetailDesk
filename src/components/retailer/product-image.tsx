"use client";

import { useState } from "react";
import { safeImageUrl } from "@/lib/product-look";
import { ProductArt } from "./product-art";

/**
 * The picture of a product. The drawn pack is always underneath, so there is a picture the instant the
 * page appears; the photo fades in over it when it has arrived, and if it never does (slow network,
 * broken address) the drawing simply stays. Always square, so the grid never jumps.
 * `priority` is for the first row: it is fetched at once instead of waiting to scroll into view.
 */
export function ProductImage({
  name,
  brand,
  imageUrl,
  dim,
  priority = false,
  className = "",
}: {
  name: string;
  brand: string;
  imageUrl?: string | null;
  dim?: boolean;
  priority?: boolean;
  className?: string;
}) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const photo = state === "failed" ? null : safeImageUrl(imageUrl);
  return (
    <div
      className={`relative aspect-square w-full overflow-hidden rounded-2xl bg-surface ${dim ? "opacity-50 grayscale" : ""} ${className}`}
    >
      {/* The drawing is only a stand-in: it fades away completely once the photo is there, so the two never show together. */}
      <div
        aria-hidden={state === "ready" || undefined}
        className={`h-full w-full p-[9%] transition-opacity duration-200 ${state === "ready" ? "opacity-0" : "opacity-100"}`}
      >
        <ProductArt name={name} brand={brand} />
      </div>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element -- already resized to a small WebP at upload; a plain image avoids a second hop
        <img
          src={photo}
          alt=""
          width={480}
          height={480}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          ref={(el) => {
            // A cached photo can finish before React attaches onLoad.
            if (el?.complete && el.naturalWidth > 0) setState("ready");
          }}
          onLoad={() => setState("ready")}
          onError={() => setState("failed")}
          className={`absolute inset-0 h-full w-full object-contain p-3 mix-blend-multiply transition-opacity duration-200 ${
            state === "ready" ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}

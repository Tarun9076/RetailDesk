"use client";

import { useState } from "react";
import { safeImageUrl } from "@/lib/product-look";
import { ProductArt } from "./product-art";

/**
 * The picture of a product: the desk's photo when there is one, otherwise a drawn pack. Always square,
 * so the grid never jumps while images load, and a photo that fails to load quietly becomes the drawing.
 */
export function ProductImage({
  name,
  brand,
  imageUrl,
  dim,
  className = "",
}: {
  name: string;
  brand: string;
  imageUrl?: string | null;
  dim?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const photo = failed ? null : safeImageUrl(imageUrl);
  return (
    <div
      className={`relative aspect-square w-full overflow-hidden rounded-2xl bg-surface ${dim ? "opacity-50 grayscale" : ""} ${className}`}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- the address is the desk's own; a plain lazy image keeps the page light
        <img
          src={photo}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-contain p-3 mix-blend-multiply"
        />
      ) : (
        <div className="h-full w-full p-[9%]">
          <ProductArt name={name} brand={brand} />
        </div>
      )}
    </div>
  );
}

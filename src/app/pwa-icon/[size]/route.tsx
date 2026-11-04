import { ImageResponse } from "next/og";

const SIZES = new Set([180, 192, 512]);

/**
 * App icons drawn in code, so there are no image files to keep in step with
 * the brand colour. "maskable" icons fill the whole square and keep the
 * letter in the middle, because Android crops them to a circle or squircle.
 */
export async function GET(req: Request, ctx: RouteContext<"/pwa-icon/[size]">) {
  const { size: raw } = await ctx.params;
  const size = Number(raw);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });

  const maskable = new URL(req.url).searchParams.get("maskable") === "1";
  const letter = Math.round(size * (maskable ? 0.5 : 0.62));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1b6b47",
          color: "#ffffff",
          fontSize: letter,
          fontWeight: 700,
          borderRadius: maskable ? 0 : Math.round(size * 0.22),
        }}
      >
        R
      </div>
    ),
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
  );
}

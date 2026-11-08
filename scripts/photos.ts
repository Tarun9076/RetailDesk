/**
 * Turns the photos you drop in `product-photos/` into small, fast ones and links them to the products.
 *
 *   product-photos/SKU-BS-075.jpg   (any size; the file name is the product code; jpg, png or webp)
 *   npm run photos
 *
 * Each photo becomes a 480 x 480 WebP of about 10 KB (a phone shows it at 150-200 px, so 480 is sharp
 * even on a 2x screen), saved in `public/products/` under a name that includes a hash of its content,
 * so it can be cached for a year and a changed photo always gets a new address. The product's photo
 * address is then set to it. Run with --dry to see what would happen without writing anything.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { toProductPhoto } from "../src/lib/product-photo";

const SOURCE = path.join(process.cwd(), "product-photos");
const OUT = path.join(process.cwd(), "public", "products");

async function main() {
  const dry = process.argv.includes("--dry");
  let files: string[];
  try {
    files = (await readdir(SOURCE)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  } catch {
    throw new Error("Make a folder called product-photos and put one photo per product in it, named by product code (SKU-BS-075.jpg).");
  }
  if (files.length === 0) throw new Error("product-photos is empty.");

  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL (or DIRECT_URL) first.");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    await mkdir(OUT, { recursive: true });
    let done = 0;
    for (const file of files.sort()) {
      const code = path.parse(file).name.toUpperCase();
      const product = await db.sku.findFirst({ where: { code } });
      if (!product) {
        console.log(`skip  ${file}: no product with code ${code}`);
        continue;
      }
      const webp = await toProductPhoto(await readFile(path.join(SOURCE, file)));
      const hash = createHash("sha256").update(webp).digest("hex").slice(0, 8);
      const name = `${code}-${hash}.webp`;
      console.log(`${dry ? "would " : ""}link  ${file} -> /products/${name} (${(webp.length / 1024).toFixed(1)} KB)`);
      if (dry) continue;
      await writeFile(path.join(OUT, name), webp);
      await db.sku.update({ where: { id: product.id }, data: { imageUrl: `/products/${name}` } });
      done++;
    }
    console.log(dry ? "Dry run: nothing written." : `Done: ${done} product photo(s) linked.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

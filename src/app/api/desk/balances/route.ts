import { getCurrentUser } from "@/lib/auth/dal";
import { parseCsv } from "@/lib/balances/parse";
import { MAX_FILE_BYTES, previewBalances, readSpreadsheet } from "@/lib/balances/service";
import { isSameOrigin, json } from "@/lib/http";

/** Upload a balance list exported from Tally (.xlsx or .csv). Returns a preview; nothing changes until it is applied. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return json({ error: "Forbidden" }, 403);
  const user = await getCurrentUser();
  if (!user || user.role !== "DESK") return json({ error: "Unauthorized" }, 401);

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  if (!file || file.size === 0) return json({ error: "no_file", message: "Choose a file first." }, 422);
  if (file.size > MAX_FILE_BYTES) return json({ error: "too_big", message: "The file is over 2 MB. Export fewer columns or split it." }, 413);

  const name = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  let cells;
  try {
    if (name.endsWith(".xlsx")) cells = await readSpreadsheet(buffer);
    else if (name.endsWith(".csv") || name.endsWith(".txt")) cells = parseCsv(buffer.toString("utf8"));
    else return json({ error: "bad_type", message: "Upload an Excel (.xlsx) or CSV (.csv) file. Older .xls files: open and Save As .xlsx first." }, 422);
  } catch {
    return json({ error: "unreadable", message: "That file could not be read. Is it a real Excel or CSV file?" }, 422);
  }

  const r = await previewBalances(cells, { source: "UPLOAD", fileName: file.name.slice(0, 120), byName: user.name });
  if (!r.ok) return json({ error: "no_match", message: r.message }, 422);
  return json({ importId: r.importId, summary: r.summary, rows: r.rows, columns: r.columns });
}

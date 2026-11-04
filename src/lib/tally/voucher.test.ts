import { describe, expect, it } from "vitest";
import { priceLine } from "@/lib/pricing/engine";
import {
  DEFAULT_TALLY_CONFIG,
  buildTallyXml,
  buildVoucher,
  rupees,
  tallyDate,
  xmlEscape,
  type TallyLine,
  type TallyOrder,
} from "./voucher";

const NOW = new Date("2026-11-04T10:00:00Z");

/** Builds a TallyLine through the real scheme engine so the two stay consistent. */
function line(
  itemName: string,
  qty: number,
  unitPaise: number,
  piecesPerCase: number,
  gstRateBp: number,
  scheme: Parameters<typeof priceLine>[0]["scheme"],
): TallyLine {
  const p = priceLine(
    { skuId: itemName, qtyCases: qty, unitPricePaise: unitPaise, piecesPerCase, gstRateBp, stockCases: 1000, scheme },
    NOW,
  );
  return {
    itemName,
    qtyCases: p.qtyCases,
    freeCases: p.freeCases,
    casePricePaise: unitPaise * piecesPerCase,
    grossPaise: p.grossPaise,
    discountPaise: p.discountPaise,
    gstRateBp,
    gstPaise: p.gstPaise,
  };
}

const biscuit = line("Glucose biscuit 75 g", 10, 790, 96, 1200, {
  type: "FREE_GOODS", buyQty: 10, freeQty: 1, label: "x",
});
const detergent = line("Detergent powder 1 kg", 5, 10150, 20, 1800, {
  type: "SLAB_PERCENT", minQty: 5, percentBp: 300, label: "x",
});
const salt = line("Iodised salt 1 kg", 2, 2400, 25, 0, null);

const order = (over: Partial<TallyOrder> = {}): TallyOrder => ({
  number: "RD-000045",
  date: NOW,
  partyLedger: "Gupta General Store",
  lines: [biscuit, detergent],
  ...over,
});

const amounts = (xml: string, tagName = "AMOUNT") =>
  [...xml.matchAll(new RegExp(`<${tagName}>(-?[\\d.]+)</${tagName}>`, "g"))].map((m) => Number(m[1]));

describe("formatting helpers", () => {
  it("formats paise as rupees without floating point", () => {
    expect(rupees(75840)).toBe("758.40");
    expect(rupees(5)).toBe("0.05");
    expect(rupees(0)).toBe("0.00");
    expect(rupees(-250)).toBe("-2.50");
    expect(rupees(1161769)).toBe("11617.69");
  });

  it("escapes XML special characters and strips illegal control characters", () => {
    expect(xmlEscape(`Ram & Sons <"Kirana"> 'Store'`)).toBe(
      "Ram &amp; Sons &lt;&quot;Kirana&quot;&gt; &apos;Store&apos;",
    );
    expect(xmlEscape("a\u0000b\u0008c")).toBe("abc");
  });

  it("uses the Indian calendar day, not UTC", () => {
    expect(tallyDate(new Date("2026-11-04T10:00:00Z"))).toBe("20261104");
    // 20:00 UTC is already 01:30 the next day in India.
    expect(tallyDate(new Date("2026-11-04T20:00:00Z"))).toBe("20261105");
  });
});

describe("voucher", () => {
  it("balances to the paisa: party debit equals sales plus all GST", () => {
    const xml = buildVoucher(order(), DEFAULT_TALLY_CONFIG);
    // Each stock line repeats its amount once on the item and once on the Sales
    // allocation. Drop the item-level one so only real ledger postings remain:
    // party debit (negative) + sales + CGST + SGST must sum to zero.
    const postings = xml.replace(/<RATE>[^<]*<\/RATE><AMOUNT>[^<]*<\/AMOUNT>/g, "");
    const cents = amounts(postings).map((a) => Math.round(a * 100));
    expect(cents.reduce((s, a) => s + a, 0)).toBe(0);
    expect(cents.some((a) => a < 0)).toBe(true); // the party debit is really there
  });

  it("debits the party with the exact order total", () => {
    const o = order();
    const total = o.lines.reduce((s, l) => s + l.grossPaise - l.discountPaise + l.gstPaise, 0);
    const xml = buildVoucher(o, DEFAULT_TALLY_CONFIG);
    expect(xml).toContain(`<ISPARTYLEDGER>Yes</ISPARTYLEDGER><AMOUNT>-${rupees(total)}</AMOUNT>`);
  });

  it("books sales net of the scheme discount", () => {
    const xml = buildVoucher(order({ lines: [detergent] }), DEFAULT_TALLY_CONFIG);
    // 5 x 20 x 101.50 = 10150.00, less 3% (304.50) = 9845.50
    expect(xml).toContain("<AMOUNT>9845.50</AMOUNT>");
    expect(xml).toContain("Scheme discount 304.50");
  });

  it("adds free goods as a zero-value stock line", () => {
    const xml = buildVoucher(order({ lines: [biscuit] }), DEFAULT_TALLY_CONFIG);
    expect(xml).toContain("<BILLEDQTY> 10 Case</BILLEDQTY>");
    expect(xml).toContain("<BILLEDQTY> 1 Case</BILLEDQTY>");
    expect(xml).toContain("<RATE>0.00/Case</RATE>");
  });

  it("splits GST evenly into CGST and SGST per rate, with no odd paisa lost", () => {
    const odd: TallyLine = { ...salt, gstRateBp: 1200, gstPaise: 101 }; // odd paise
    const xml = buildVoucher(order({ lines: [odd] }), DEFAULT_TALLY_CONFIG);
    expect(xml).toContain("Output CGST @6%");
    expect(xml).toContain("Output SGST @6%");
    const gst = [...xml.matchAll(/Output [CS]GST @6%<\/LEDGERNAME><ISDEEMEDPOSITIVE>No<\/ISDEEMEDPOSITIVE><AMOUNT>([\d.]+)/g)]
      .map((m) => Math.round(Number(m[1]) * 100));
    expect(gst).toEqual([50, 51]);
  });

  it("writes separate GST ledgers for different rates and none for a 0% item", () => {
    const xml = buildVoucher(order({ lines: [biscuit, detergent, salt] }), DEFAULT_TALLY_CONFIG);
    expect(xml).toContain("Output CGST @6%");
    expect(xml).toContain("Output CGST @9%");
    expect(xml).not.toContain("@0%");
  });

  it("escapes shop names and notes so one bad character cannot break the file", () => {
    const xml = buildVoucher(
      order({ partyLedger: "Ram & Sons <Kirana>", note: `Deliver "early" & fast` }),
      DEFAULT_TALLY_CONFIG,
    );
    expect(xml).toContain("Ram &amp; Sons &lt;Kirana&gt;");
    expect(xml).toContain("Deliver &quot;early&quot; &amp; fast");
    expect(xml).not.toContain("Ram & Sons");
  });
});

describe("buildTallyXml", () => {
  it("wraps every order in one import envelope", () => {
    const xml = buildTallyXml([order(), order({ number: "RD-000046" })]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml.match(/<VOUCHER /g)).toHaveLength(2);
    expect(xml).toContain("<VOUCHERNUMBER>RD-000046</VOUCHERNUMBER>");
    expect(xml).toContain("<TALLYREQUEST>Import Data</TALLYREQUEST>");
  });

  it("is well formed: every opened tag is closed", () => {
    const xml = buildTallyXml([order({ lines: [biscuit, detergent, salt] })]);
    const open = xml.match(/<[A-Z][A-Z.]*[ >]/g)?.length ?? 0;
    const close = xml.match(/<\/[A-Z][A-Z.]*>/g)?.length ?? 0;
    expect(open).toBe(close);
  });

  it("includes the company name when configured", () => {
    const xml = buildTallyXml([order()], { ...DEFAULT_TALLY_CONFIG, company: "Company A & Co" });
    expect(xml).toContain("<SVCURRENTCOMPANY>Company A &amp; Co</SVCURRENTCOMPANY>");
  });
});

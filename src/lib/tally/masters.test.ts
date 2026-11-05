import { describe, expect, it } from "vitest";
import { mastersToCsv, mergeTallySettings, requiredMasters, templateProblem } from "./masters";
import { DEFAULT_TALLY_CONFIG, buildTallyXml, gstLedgerName, type TallyOrder } from "./voucher";

const order: TallyOrder = {
  number: "RD-000001",
  date: new Date("2026-11-04T10:00:00Z"),
  partyLedger: "Gupta General Store",
  lines: [
    { itemName: "Glucose biscuit 75 g", qtyCases: 10, freeCases: 1, casePricePaise: 75840, grossPaise: 758400, discountPaise: 0, gstRateBp: 1200, gstPaise: 91008 },
  ],
};

describe("ledger names in the Tally file", () => {
  it("keeps the standard names when nothing is set", () => {
    const xml = buildTallyXml([order], DEFAULT_TALLY_CONFIG);
    expect(xml).toContain("<LEDGERNAME>Output CGST @6%</LEDGERNAME>");
    expect(xml).toContain("<LEDGERNAME>Output SGST @6%</LEDGERNAME>");
    expect(xml).toContain('VCHTYPE="Sales"');
    expect(xml).toContain("<LEDGERNAME>Sales</LEDGERNAME>");
  });

  it("uses the names the desk saved, for the sales ledger, GST ledgers, unit and voucher type", () => {
    const xml = buildTallyXml([order], {
      company: "ABC Distributors (2026-27)",
      salesLedger: "Sales - Local",
      unit: "Ctn",
      cgstLedger: "CGST Output {rate}%",
      sgstLedger: "SGST Output {rate}%",
      voucherType: "Sales GST",
    });
    expect(xml).toContain("<LEDGERNAME>Sales - Local</LEDGERNAME>");
    expect(xml).toContain("<LEDGERNAME>CGST Output 6%</LEDGERNAME>");
    expect(xml).toContain("<LEDGERNAME>SGST Output 6%</LEDGERNAME>");
    expect(xml).toContain('VCHTYPE="Sales GST"');
    expect(xml).toContain("<VOUCHERTYPENAME>Sales GST</VOUCHERTYPENAME>");
    expect(xml).toContain(" 10 Ctn");
    expect(xml).toContain("<SVCURRENTCOMPANY>ABC Distributors (2026-27)</SVCURRENTCOMPANY>");
    expect(xml).not.toContain("Output CGST");
  });

  it("escapes a voucher type with symbols, so the file stays valid XML", () => {
    const xml = buildTallyXml([order], { ...DEFAULT_TALLY_CONFIG, voucherType: 'Sales "A" & B' });
    expect(xml).toContain('VCHTYPE="Sales &quot;A&quot; &amp; B"');
  });

  it("builds half-rate names, including half percentages", () => {
    expect(gstLedgerName("Output CGST @{rate}%", 1200)).toBe("Output CGST @6%");
    expect(gstLedgerName("Output CGST @{rate}%", 500)).toBe("Output CGST @2.5%");
    expect(gstLedgerName("{rate} CGST / {rate}", 1800)).toBe("9 CGST / 9");
  });
});

describe("the set-up checklist", () => {
  const input = {
    gstRatesBp: [1200, 1800, 0, 1200],
    shops: [
      { shopName: "Gupta General Store", tallyLedgerName: null },
      { shopName: "Yadav Kirana", tallyLedgerName: "Yadav Kirana Store (Napier)" },
    ],
    productNames: ["Glucose biscuit 75 g", "Detergent powder 1 kg"],
  };
  const items = requiredMasters(DEFAULT_TALLY_CONFIG, input);
  const names = (g: string) => items.filter((i) => i.group === g).map((i) => i.name);

  it("lists each thing once: voucher type, sales ledger, unit, GST ledgers for the rates in use, shops and products", () => {
    expect(names("Voucher type")).toEqual(["Sales"]);
    expect(names("Sales ledger")).toEqual(["Sales"]);
    expect(names("Unit")).toEqual(["Case"]);
    expect(names("GST ledger")).toEqual(["Output CGST @6%", "Output SGST @6%", "Output CGST @9%", "Output SGST @9%"]);
    expect(names("Stock item")).toEqual(input.productNames);
  });
  it("uses a shop's Tally name when it has one, and its shop name otherwise", () => {
    expect(names("Party ledger")).toEqual(["Gupta General Store", "Yadav Kirana Store (Napier)"]);
  });
  it("makes a CSV that survives commas and quotes", () => {
    const csv = mastersToCsv([{ group: "Party ledger", name: 'Ram, "The" Store', note: "Under Sundry Debtors" }]);
    expect(csv).toBe('Type,Name in Tally,Notes\r\n"Party ledger","Ram, ""The"" Store","Under Sundry Debtors"\r\n');
  });
});

describe("saved settings", () => {
  it("fall back to the standard names for blank boxes, and to TALLY_COMPANY for the company", () => {
    const cfg = mergeTallySettings({ salesLedger: "  Sales - Local  ", unit: "" }, "Env Company");
    expect(cfg).toMatchObject({ salesLedger: "Sales - Local", unit: "Case", cgstLedger: "Output CGST @{rate}%", voucherType: "Sales", company: "Env Company" });
    expect(mergeTallySettings({ company: "Saved Co" }, "Env Company").company).toBe("Saved Co");
    expect(mergeTallySettings({}).company).toBeUndefined();
  });
  it("need {rate} in a GST ledger name, or every rate would share one ledger", () => {
    expect(templateProblem("Output CGST")).toMatch(/\{rate\}/);
    expect(templateProblem("Output CGST @{rate}%")).toBeNull();
    expect(templateProblem("")).toBeNull();
  });
});

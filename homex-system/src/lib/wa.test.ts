import { describe, it, expect } from "vitest";
import { renderWaTemplate, waLinkFor, DEFAULT_WA_DELIVERY } from "./wa";

describe("renderWaTemplate", () => {
  it("fills known placeholders", () => {
    const out = renderWaTemplate("مرحباً {customer} — طلب {number}", { customer: "علي", number: "HX-2026-0001" });
    expect(out).toBe("مرحباً علي — طلب HX-2026-0001");
  });

  it("drops unknown/empty placeholders and collapses blank lines", () => {
    const out = renderWaTemplate("a {missing}\n\n\n{time}\nb", { time: "" });
    expect(out).toBe("a\n\nb");
  });

  it("renders the delivery default with values", () => {
    const out = renderWaTemplate(DEFAULT_WA_DELIVERY, {
      customer: "سالم", date: "10/01/2026", time: "", company: "Homex", companyPhone: "+968 90000000",
    });
    expect(out).toContain("سالم");
    expect(out).toContain("10/01/2026");
    expect(out).toContain("Homex");
    expect(out).not.toContain("{"); // no leftover placeholders
  });
});

describe("waLinkFor", () => {
  it("builds a WhatsApp link with digits only and encoded text", () => {
    // No browser in the test env → the desktop web.whatsapp.com link.
    const link = waLinkFor("+968", "9123 4567", "hi there");
    expect(link).toBe("https://web.whatsapp.com/send?phone=96891234567&text=hi%20there");
  });
});

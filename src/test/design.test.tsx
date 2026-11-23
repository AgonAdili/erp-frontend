import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { StatusBand, change } from "@/components/dashboard";
import { addDays, displayValue, formatAmount, formatAmountWhole, formatCompact, formatLongDate, formatMoney, formatNumber, isoLocal } from "@/lib/format";
import { groupForPath } from "@/nav/modules";
import { listUrl } from "@/screens/overviews/common";

describe("Macedonian formatting (independent of the browser's locale data)", () => {
  it("groups thousands with dots and uses a decimal comma", () => {
    expect(formatMoney("1234567.5")).toBe("1.234.567,50");
    expect(formatMoney(-12.3)).toBe("−12,30");
    expect(formatNumber(1000, 0)).toBe("1.000");
    expect(formatNumber("2.500")).toBe("2,5");
    expect(formatNumber(16.666, 1)).toBe("16,7");
  });

  it("shortens only from one million up (млн / млрд)", () => {
    expect(formatCompact(9999)).toBe("9.999");
    expect(formatCompact(42_500)).toBe("42.500");
    expect(formatCompact(1_211_574)).toBe("1,21 млн");
    expect(formatCompact(3_100_000_000)).toBe("3,1 млрд");
  });

  it("puts the ISO code after the amount", () => {
    expect(formatAmount(1234567)).toBe("1.234.567,00 MKD");
    expect(formatAmount(-1500.5, "EUR")).toBe("−1.500,50 EUR");
    expect(formatAmountWhole(4323263.4)).toBe("4.323.263 MKD");
    expect(formatAmount(null)).toBe("—");
  });

  it("leaves years and codes ungrouped", () => {
    expect(displayValue({ year: 2016 }, "year", "integer")).toBe("2016");
    expect(displayValue({ odometer_km: 103000 }, "odometer_km", "integer")).toBe("103.000");
  });

  it("works with local dates, not UTC", () => {
    expect(isoLocal(new Date(2026, 9, 27, 0, 30))).toBe("2026-10-27");
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(formatLongDate(new Date(2026, 9, 27))).toBe("вторник, 27 октомври 2026");
  });

  it("computes percent change only against a base", () => {
    expect(change(150, 100)).toBe(50);
    expect(change(5, 0)).toBeNull();
  });
});

describe("navigation", () => {
  it("places routes in their rail group", () => {
    expect(groupForPath("/assets/vehicles/3")?.key).toBe("fleet");        // claimed by fleet, not by its URL section
    expect(groupForPath("/payables")?.key).toBe("finance");
    expect(groupForPath("/hr/attendance-day")?.key).toBe("people");
    expect(groupForPath("/")).toBeUndefined();
  });

  it("builds filtered list links", () => {
    expect(listUrl("offers/offers", { status: "SENT", page: undefined })).toBe("/offers/offers?status=SENT");
  });
});

describe("StatusBand", () => {
  it("links each stage to its list and marks the ones waiting on someone", () => {
    render(
      <MemoryRouter>
        <StatusBand title="Тек" stages={[
          { key: "a", label: "Нацрт", count: 3, to: "/x?status=DRAFT" },
          { key: "b", label: "Чекаат", count: 2, attention: true, to: "/x?status=PENDING" },
          { key: "c", label: "Готови", count: 0, done: true },
        ]} />
      </MemoryRouter>,
    );
    const pending = screen.getByRole("link", { name: "Чекаат: 2" });
    expect(pending).toHaveAttribute("href", "/x?status=PENDING");
    expect(pending.className).toContain("attention");
    expect(screen.getByText("Готови").parentElement?.className).toContain("zero");
  });
});

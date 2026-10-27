import { afterEach, describe, expect, it, vi } from "vitest";

import { api, ApiError, buildUrl, setCsrfToken } from "@/api/client";
import type { ActionMeta, Row } from "@/api/types";
import { hasCode } from "@/auth/session";
import { displayValue, formatDate, formatMoney } from "@/lib/format";
import { endpointFor, routeFor } from "@/meta/hooks";
import { actionApplies } from "@/screens/actions";
import { distribute } from "@/screens/allocations";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => vi.restoreAllMocks());

describe("api client", () => {
  it("builds query strings and skips empty values", () => {
    expect(buildUrl("/hr/payroll/", { year: 2026, month: "", status: null, ids: [1, 2] }))
      .toBe("/api/v1/hr/payroll/?year=2026&ids=1%2C2");
    expect(buildUrl("/api/v1/x/", { a: 1 })).toBe("/api/v1/x/?a=1");
  });

  it("sends CSRF and If-Match on writes", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ id: 1 }));
    setCsrfToken("tok");
    await api.patch("/hr/payroll/1/", { bonuses: "10" }, 4);
    const [, init] = fetchMock.mock.calls[0];
    const headers = init!.headers as Record<string, string>;
    expect(headers["X-CSRFToken"]).toBe("tok");
    expect(headers["If-Match"]).toBe('"4"');
    expect(init!.credentials).toBe("same-origin");
  });

  it("maps the server error shape to ApiError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ detail: "Исплатена плата не може да се менува.", code: "payroll_paid", errors: { bonuses: ["x"] } }, 400));
    const err = (await api.post("/hr/payroll/1/approve/").catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("payroll_paid");
    expect(err.fieldError("bonuses")).toBe("x");
    expect(err.message).toContain("Исплатена");
  });
});

describe("formatting", () => {
  it("uses Macedonian number and date conventions", () => {
    expect(formatMoney("12345.6")).toMatch(/12.345,60/);
    expect(formatDate("2026-03-02")).toBe("02.03.2026");
  });

  it("prefers server labels and display values", () => {
    const row = { id: 1, status: "PAID", status_display: "Исплатено", employee: 3, employee_label: "Ана Петрова" } as Row;
    expect(displayValue(row, "status", "choice")).toBe("Исплатено");
    expect(displayValue(row, "employee", "fk")).toBe("Ана Петрова");
    expect(displayValue({ id: 1, ok: true } as Row, "ok", "boolean")).toBe("Да");
  });
});

describe("routing and permissions", () => {
  it("maps endpoints to routes and back", () => {
    expect(routeFor("/api/v1/fleet/travel-orders/")).toBe("/fleet/travel-orders");
    expect(endpointFor("fleet", "travel-orders")).toBe("/api/v1/fleet/travel-orders/");
  });

  it("reads permission codes like the server", () => {
    const session = { access: { codes: ["hr.payroll.view", "hr.leaves.edit"] } } as never;
    expect(hasCode(session, "hr.payroll.view")).toBe(true);
    expect(hasCode(session, "hr.payroll")).toBe(true);
    expect(hasCode(session, "hr.leaves.view")).toBe(false);
    expect(hasCode({ access: { codes: ["*"] } } as never, "anything.at.all")).toBe(true);
  });

  it("offers an action only when allowed and in a matching state", () => {
    const action = { allowed: true, when: { status: ["DRAFT"] } } as unknown as ActionMeta;
    expect(actionApplies(action, { id: 1, status: "DRAFT" } as Row)).toBe(true);
    expect(actionApplies(action, { id: 1, status: "PAID" } as Row)).toBe(false);
    expect(actionApplies({ ...action, allowed: false }, { id: 1, status: "DRAFT" } as Row)).toBe(false);
  });
});

describe("payment allocation", () => {
  const item = (id: number, open: string, due: string | null, date = "2026-01-01") =>
    ({ id, invoice_number: `F-${id}`, invoice_date: date, due_date: due, original_amount: open, open_amount: open,
      status: "OPEN", legal_entity: 1 });

  it("settles the oldest due first, each item up to its open amount", () => {
    const rows = distribute([item(1, "100.00", "2026-03-01"), item(2, "50.10", "2026-02-01"), item(3, "80", null)], 120, "payable");
    expect(rows).toEqual([{ payable: 2, amount: "50.10" }, { payable: 1, amount: "69.90" }]);
  });

  it("leaves the rest unallocated when the payment exceeds the open items", () => {
    expect(distribute([item(1, "10", "2026-01-05")], 25, "receivable")).toEqual([{ receivable: 1, amount: "10.00" }]);
  });
});

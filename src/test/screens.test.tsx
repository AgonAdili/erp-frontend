import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { ResourceMeta } from "@/api/types";
import { ToastProvider } from "@/components/ui";
import { TasksProvider } from "@/components/tasks";
import { ResourceForm } from "@/screens/ResourceForm";
import { ResourceList } from "@/screens/ResourceList";

const META: ResourceMeta = {
  key: "hr.leaves", model: "hr.leaverequest", title: "Отсуства", title_singular: "Отсуство", module: "hr",
  endpoint: "/api/v1/hr/leaves/", resources: ["hr.leaves"],
  permissions: { view: true, add: true, edit: true, delete: true },
  fields: [
    { name: "id", label: "ID", type: "integer", required: false, read_only: true, nullable: false, help_text: "" },
    { name: "category", label: "Категорија", type: "choice", required: true, read_only: false, nullable: false, help_text: "",
      choices: [{ value: "PAID", label: "Платено отсуство" }, { value: "SICK", label: "Боледување" }] },
    { name: "start_date", label: "Почетен датум", type: "date", required: true, read_only: false, nullable: false, help_text: "" },
    { name: "reason", label: "Причина", type: "text", required: false, read_only: false, nullable: false, help_text: "" },
  ],
  columns: [
    { name: "category", label: "Категорија", type: "choice", sortable: true },
    { name: "start_date", label: "Почетен датум", type: "date", sortable: true },
  ],
  filters: [{ name: "category", label: "Категорија", lookups: ["exact"], type: "choice",
    choices: [{ value: "PAID", label: "Платено отсуство" }] }],
  search: true, ordering: ["-start_date"], ordering_fields: null, actions: [], bulk_actions: [],
  export_formats: ["xlsx"], entity_scoped: true, form_layout: null, detail_layout: null, versioned: true,
};

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ToastProvider><TasksProvider>{ui}</TasksProvider></ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => vi.restoreAllMocks());

describe("ResourceList", () => {
  it("renders columns and rows from metadata and sorts on header click", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => json({
      count: 1, page: 1, page_size: 25, pages: 1,
      results: [{ id: 7, category: "PAID", category_display: "Платено отсуство", start_date: "2026-03-06" }],
    }));
    wrap(<ResourceList meta={META} />);
    expect(await screen.findByText("Платено отсуство")).toBeInTheDocument();
    expect(screen.getByText("06.03.2026")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("columnheader", { name: /Почетен датум/ }));
    await waitFor(() => expect(String(fetchMock.mock.calls.at(-1)![0])).toContain("ordering=start_date"));
  });
});

describe("ResourceForm", () => {
  it("posts the fields and shows server validation errors on them", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ detail: "Платеното отсуство ја надминува годишната квота.", code: "invalid",
        errors: { category: ["Платеното отсуство ја надминува годишната квота."] } }, 400));
    wrap(<ResourceForm meta={META} onSaved={() => undefined} />);
    await userEvent.selectOptions(screen.getByLabelText(/Категорија/), "PAID");
    await userEvent.type(screen.getByLabelText(/Почетен датум/), "2026-03-06");
    await userEvent.click(screen.getByRole("button", { name: "Зачувај" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("годишната квота");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("/api/v1/hr/leaves/");
    expect(JSON.parse(String(init!.body))).toEqual({ category: "PAID", start_date: "2026-03-06" });
  });
});

describe("report actions", () => {
  it("fetch the report and render its rows as a table", async () => {
    const { ActionButton } = await import("@/screens/actions");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(json({
      totals: { debit: "1000.00", credit: "1000.00" },
      rows: [{ account_code: "1020", account_name: "Банка", debit: "1000.00", credit: "0.00" }],
    }));
    wrap(<ActionButton meta={META} action={{
      name: "trial_balance", url_path: "trial-balance", detail: false, methods: ["GET"], label: "Бруто биланс",
      confirm: "", danger: false, when: {}, input: [], variant: "", group: "Извештаи", download: false, kind: "report",
      allowed: true,
    }} />);
    await userEvent.click(screen.getByRole("button", { name: "Бруто биланс" }));
    expect(await screen.findByText("Банка")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/v1/hr/leaves/trial-balance/");
  });
});

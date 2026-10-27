/** Partners overview: the onboarding lane (draft → verification → active), blocked partners, document
 * alerts, and the most recently added partners. */
import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import type { Page as ApiPage, Row } from "@/api/types";
import { DataTable, Kpi, Kpis, StatusBand, useOverview, type Data } from "@/components/dashboard";
import { Badge, LinkButton, Panel, statusTone } from "@/components/ui";
import { formatNumber } from "@/lib/format";

import { listUrl, Overview } from "./common";

const P = "partners/partners";

export function PartnersOverview() {
  const q = useOverview<Data>(`/${P}/summary/`, {}, { entity: false });
  const latest = useQuery({ queryKey: ["list", `/api/v1/${P}/`, "latest"], queryFn: () => api.get<ApiPage<Row>>(`/${P}/`, { ordering: "-created_at", page_size: 8 }) });
  return (
    <Overview title="Партнери" q={q} entityScoped={false} actions={<LinkButton to={`/${P}/new`} variant="primary">Нов партнер</LinkButton>}>
      {(d) => {
        const s = d.by_status as Record<string, number>;
        return (
          <>
            <StatusBand title="Од внес до активен партнер" total={`${formatNumber(d.total, 0)} вкупно`} stages={[
              { key: "draft", label: "Нацрт", count: s.DRAFT ?? 0, to: listUrl(P, { status: "DRAFT" }) },
              { key: "verify", label: "Во проверка", count: s.IN_VERIFICATION ?? 0, attention: true, to: listUrl(P, { status: "IN_VERIFICATION" }) },
              { key: "active", label: "Активни", count: s.ACTIVE ?? 0, done: true, to: listUrl(P, { status: "ACTIVE" }) },
              { key: "passive", label: "Пасивни", count: s.PASSIVE ?? 0, to: listUrl(P, { status: "PASSIVE" }) },
              { key: "blocked", label: "Блокирани", count: s.BLOCKED ?? 0, danger: true, to: listUrl(P, { status: "BLOCKED" }) },
              { key: "black", label: "Црна листа", count: s.BLACKLIST ?? 0, danger: true, to: listUrl(P, { status: "BLACKLIST" }) },
            ]} />
            <Kpis>
              <Kpi label="Активни партнери" value={formatNumber(s.ACTIVE ?? 0, 0)} sub={d.total ? `${formatNumber(((s.ACTIVE ?? 0) / d.total) * 100, 0)}% од сите` : undefined} />
              <Kpi label="Чекаат проверка" value={formatNumber(s.IN_VERIFICATION ?? 0, 0)} tone={s.IN_VERIFICATION ? "attention" : undefined} to={listUrl(P, { status: "IN_VERIFICATION" })} />
              <Kpi label="Истечени документи" value={formatNumber(d.alerts?.expired ?? 0, 0)} sub="кај активни партнери" tone={d.alerts?.expired ? "alarm" : undefined} />
              <Kpi label="Документи што истекуваат" value={formatNumber(d.alerts?.expiring ?? 0, 0)} sub="во следните 30 дена" tone={d.alerts?.expiring ? "attention" : undefined} />
            </Kpis>
            <Panel title="Последно внесени" flush actions={<LinkButton to={`/${P}`} size="sm">Сите партнери</LinkButton>}>
              <DataTable rows={latest.data?.results ?? []} columns={[
                { key: "legal_name", label: "Партнер", to: (r) => `/${P}/${r.id}`, render: (r) => String(r._label ?? r.legal_name ?? `#${r.id}`) },
                { key: "tax_number", label: "ЕДБ" },
                { key: "status", label: "Статус", render: (r) => <Badge tone={statusTone(String(r.status))}>{String(r.status_display ?? r.status)}</Badge> },
                { key: "created_at", label: "Внесен", kind: "datetime" }]} />
            </Panel>
          </>
        );
      }}
    </Overview>
  );
}

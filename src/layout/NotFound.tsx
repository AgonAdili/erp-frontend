import { Compass, Lock } from "lucide-react";

import { EmptyState, LinkButton } from "@/components/ui";
import { t } from "@/i18n/mk";

import { Page } from "./Page";

export function NotFound() {
  return (
    <Page title={t.notFoundTitle}>
      <EmptyState icon={Compass} title={t.notFoundTitle} action={<LinkButton to="/" variant="primary">{t.goHome}</LinkButton>}>
        {t.notFoundText}
      </EmptyState>
    </Page>
  );
}

export function Forbidden() {
  return (
    <Page title={t.forbiddenTitle}>
      <EmptyState icon={Lock} title={t.forbiddenTitle} action={<LinkButton to="/">{t.goHome}</LinkButton>}>{t.forbiddenText}</EmptyState>
    </Page>
  );
}

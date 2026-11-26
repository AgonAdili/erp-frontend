/** A screen's frame: sets the document title. */
import { useEffect, type ReactNode } from "react";

import { t } from "@/i18n/mk";

export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (title) document.title = `${title} — ${t.appName}`;
  }, [title]);
}

export function Page({ title, children, narrow }: { title?: string; children: ReactNode; narrow?: boolean }) {
  useDocumentTitle(title);
  return <div className={`page${narrow ? " narrow" : ""}`}>{children}</div>;
}

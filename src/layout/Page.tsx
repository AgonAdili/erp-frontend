/** A screen's frame: sets the document title and the last breadcrumb. */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { t } from "@/i18n/mk";

const CrumbContext = createContext<{ crumb: string; setCrumb: (c: string) => void }>({ crumb: "", setCrumb: () => undefined });

export function CrumbProvider({ children }: { children: ReactNode }) {
  const [crumb, setCrumb] = useState("");
  return <CrumbContext.Provider value={{ crumb, setCrumb }}>{children}</CrumbContext.Provider>;
}

export function useCrumb() {
  return useContext(CrumbContext).crumb;
}

export function useDocumentTitle(title: string | undefined, crumb?: string) {
  const { setCrumb } = useContext(CrumbContext);
  useEffect(() => {
    // CORE: tab title "Наслов — EACore"
    if (title) document.title = `${title} — ${t.appName}`;
    setCrumb(crumb ?? "");
    return () => setCrumb("");
  }, [title, crumb, setCrumb]);
}

/** FE page wrapper. `board` = a module overview or Home (FE .ea-board: board panel titles, numbered sections).
 * The module colour (data-module) is set once on <main> by the shell. */
export function Page({ title, crumb, children, narrow, board }: { title?: string; crumb?: string; children: ReactNode; narrow?: boolean; board?: boolean }) {
  useDocumentTitle(title, crumb);
  return <div className={`ea-page${board ? " ea-board" : ""}${narrow ? " is-narrow" : ""}`}>{children}</div>;
}

/*! @license © 2026 Mia Spasovska. EACore design system (CORE) and front-end specification (FE) — author: Mia Spasovska. All rights reserved unless agreed otherwise in writing. Fingerprint EAC-MS-C226E467F1A53502. */
import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ApiError } from "@/api/client";
import { PrefsProvider, usePrefs } from "@/app/prefs";
import { SessionProvider } from "@/auth/session";
import { TasksProvider } from "@/components/tasks";
import { ToastProvider, TooltipProvider } from "@/components/ui";

import { App } from "./App";
// EACore FE design system: CORE tokens, the FE stylesheet, the CORE extensions (same files as FE/static/css), then the
// adapter for this app's own screens. Fonts (Inter, IBM Plex Mono) are self-hosted by ea-tokens.css.
import "./styles/ea-tokens.css";
import "./styles/ea-fe.css";
import "./styles/ea-core-ext.css";
import "./styles/app.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // no retries on client errors (permission, validation, not found)
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
});

function Themed({ children }: { children: ReactNode }) {
  const { resolvedTheme } = usePrefs();
  return <ToastProvider theme={resolvedTheme}>{children}</ToastProvider>;
}

// A data router (one splat route) so forms can block navigation with unsaved changes; screens use <Routes> inside.
const router = createBrowserRouter([{
  path: "*",
  element: (
    <SessionProvider>
      <PrefsProvider>
        <Themed>
          <TooltipProvider delayDuration={350}>
            <TasksProvider>
              <App />
            </TasksProvider>
          </TooltipProvider>
        </Themed>
      </PrefsProvider>
    </SessionProvider>
  ),
}]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);

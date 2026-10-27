import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";

import { ApiError } from "@/api/client";
import { PrefsProvider, usePrefs } from "@/app/prefs";
import { SessionProvider } from "@/auth/session";
import { TasksProvider } from "@/components/tasks";
import { ToastProvider, TooltipProvider } from "@/components/ui";

import { App } from "./App";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/layout.css";
import "./styles/screens.css";

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

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { Toaster } from "react-hot-toast";
import App from "./app/App";
import { useThemeStore } from "./store";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { buildMuiTheme } from "./config/themes";
import "@/shared/styles/index.scss";

const { themeId, colorMode } = useThemeStore.getState();
document.documentElement.setAttribute("data-theme", themeId);
document.documentElement.setAttribute("data-mode", colorMode);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Root() {
  const themeId = useThemeStore((s) => s.themeId);
  const colorMode = useThemeStore((s) => s.colorMode);
  const muiTheme = buildMuiTheme(themeId, colorMode);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--surface-2)",
            color: "var(--text)",
            border: "1px solid var(--border-2)",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
          },
        }}
      />
    </ThemeProvider>
  );
}

async function bootstrap() {
  if (import.meta.env.VITE_USE_MOCK === "true") {
    const { enableMocks } = await import("./services/mock");
    enableMocks();
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <Root />
          </BrowserRouter>
        </QueryClientProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}

bootstrap();

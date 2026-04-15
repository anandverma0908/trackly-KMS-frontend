import type { Theme, ThemeId, ColorMode } from "@/types";
import { createTheme } from "@mui/material";

export const THEMES: Theme[] = [
  { id: "default", name: "Cobalt", color: "#4F7EFF" },
  { id: "emerald", name: "Emerald", color: "#10B981" },
  { id: "violet", name: "Violet", color: "#8B5CF6" },
  { id: "rose", name: "Rose", color: "#F43F5E" },
];

export const DEFAULT_THEME: ThemeId = "default";
export const DEFAULT_MODE: ColorMode = "dark";

export function applyTheme(themeId: ThemeId, mode: ColorMode) {
  const html = document.documentElement;
  html.setAttribute("data-theme", themeId);
  html.setAttribute("data-mode", mode);
}

/* ── POD colors — consistent across charts & cards ── */
export const POD_COLORS: Record<string, string> = {
  DPAI:       "#4F7EFF",
  SNOP:       "#A78BFA",
  EDM:        "#FBBF24",
  PLAT:       "#34D399",
  SNOE:       "#22D3EE",
  PA:           "#F87171",
};

export function getPodColor(pod: string): string {
  return POD_COLORS[pod] ?? "#8B8FA8";
}

/* ── Issue type badge variant ── */
export const ISSUE_TYPE_VARIANT: Record<string, string> = {
  Feature: "badge-blue",
  Bug: "badge-red",
  Meeting: "badge-amber",
  Task: "badge-purple",
  Story: "badge-cyan",
};

export const STATUS_VARIANT: Record<string, string> = {
  Done: "badge-green",
  Open: "badge-gray",
  "In Progress": "badge-amber",
  "QA In Progress": "badge-amber",
  Closed: "badge-green",
};

export function getIssueTypeBadge(type: string) {
  return ISSUE_TYPE_VARIANT[type] ?? "badge-gray";
}
export function getStatusBadge(status: string) {
  return STATUS_VARIANT[status] ?? "badge-gray";
}
export const CLIENT_COLORS = [
  "#4F7EFF",
  "#34D399",
  "#FBBF24",
  "#F87171",
  "#A78BFA",
  "#22D3EE",
  "#FB923C",
  "#E879F9",
  "#4ADE80",
  "#F472B6",
];

// src/config/muiTheme.ts

export function buildMuiTheme(themeId: ThemeId, colorMode: ColorMode) {
  const accent = THEMES.find((t) => t.id === themeId)?.color ?? "#4F7EFF";
  const dark = colorMode === "dark";

  return createTheme({
    palette: {
      mode: dark ? "dark" : "light",
      primary: { main: accent },
      secondary: { main: "#818CF8" },
      background: {
        default: dark ? "#0F1117" : "#F0F2F5",
        paper: dark ? "#1A1D27" : "#FFFFFF",
      },
      success: { main: "#34D399" },
      warning: { main: "#FBBF24" },
      error: { main: "#F87171" },
      // Stronger divider in dark mode so borders are visible
      divider: dark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.09)",
    },

    typography: {
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      h4: { fontWeight: 800, letterSpacing: "-0.05em" },
      h5: { fontWeight: 700, letterSpacing: "-0.04em" },
      h6: { fontWeight: 700, letterSpacing: "-0.03em" },
      subtitle1: { fontWeight: 500 },
      subtitle2: {
        fontWeight: 600,
        fontSize: "0.75rem",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      },
      body2: { fontSize: "0.8125rem" },
      caption: { fontSize: "0.6875rem" },
    },

    shape: { borderRadius: 10 },

    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            textTransform: "none",
            fontWeight: 600,
            fontSize: "0.8125rem",
            borderRadius: 8,
          },
          sizeSmall: { padding: "5px 12px", fontSize: "0.75rem" },
          containedPrimary: {
            background: `linear-gradient(135deg, ${accent}, #818CF8)`,
            "&:hover": {
              background: `linear-gradient(135deg, ${accent}dd, #818CF8dd)`,
            },
          },
        },
      },

      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: ({ theme }) => ({
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 12,
            // Kill MUI dark mode gradient on cards
            backgroundImage: "none",
          }),
        },
      },

      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: ({ theme }) => ({
            border: `1px solid ${theme.palette.divider}`,
            // KEY: always use theme background, never MUI's elevation overlay
            backgroundImage: "none",
            backgroundColor: theme.palette.background.paper,
          }),
        },
      },

      // Popover inherits from Paper — but explicitly setting it
      // ensures the portal renders with correct dark bg every time
      MuiPopover: {
        styleOverrides: {
          paper: ({ theme }) => ({
            backgroundImage: "none",
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            boxShadow:
              theme.palette.mode === "dark"
                ? "0 8px 32px rgba(0,0,0,0.6)"
                : "0 8px 32px rgba(0,0,0,0.12)",
          }),
        },
      },

      // Menu (dropdowns) same treatment
      MuiMenu: {
        styleOverrides: {
          paper: ({ theme }) => ({
            backgroundImage: "none",
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          }),
        },
      },

      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 6, fontWeight: 600, fontSize: "0.6875rem" },
        },
      },

      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 700,
            fontSize: "0.6875rem",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          },
          body: { fontSize: "0.8125rem" },
        },
      },

      MuiTextField: {
        defaultProps: { size: "small", variant: "outlined" },
      },

      MuiSelect: {
        defaultProps: { size: "small" },
      },

      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundImage: "none",
            backgroundColor: theme.palette.background.paper,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }),
        },
      },

      MuiDrawer: {
        styleOverrides: {
          paper: ({ theme }) => ({
            backgroundImage: "none",
            backgroundColor: theme.palette.background.paper,
            borderRight: `1px solid ${theme.palette.divider}`,
          }),
        },
      },

      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            margin: "1px 6px",
            width: "calc(100% - 12px)",
          },
        },
      },

      MuiTooltip: {
        styleOverrides: {
          tooltip: ({ theme }) => ({
            backgroundColor:
              theme.palette.mode === "dark" ? "#2D3148" : "#1A1D27",
            fontSize: "0.6875rem",
            fontWeight: 500,
            borderRadius: 6,
          }),
        },
      },
    },
  });
}

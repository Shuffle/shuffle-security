/**
 * ShuffleCoreThemeProvider
 *
 * Single source of truth for theming inside Shuffle-Core surfaces. Two jobs:
 *
 * 1. Pin MUI component defaults so TextField / Button / Select / FormControl /
 *    Autocomplete render at `size="small"` (36px buttons, ~38px text fields)
 *    so individual call sites never need to thread `size="small"` through.
 *
 * 2. Bridge the host app's light/dark scheme into MUI:
 *    - `mode="auto"` (default) — track the `.dark` class on `<html>` and flip
 *      MUI `palette.mode` accordingly. Tokens (`hsl(var(--…))`) flip automatically
 *      with the same class, so nothing else has to know about the theme.
 *    - `mode="light"` / `mode="dark"` — force a scheme on the wrapped subtree.
 *      We render a `<div className="dark">` (or remove it) so Tailwind's
 *      class-based dark variants and the CSS-variable overrides scope to this
 *      subtree only — useful when embedding Shuffle-Core inside a host that
 *      doesn't manage `.dark` on `<html>`.
 *
 * This is the clean API: callers either let Shuffle-Core inherit the host's
 * theme (auto), or pin a mode at the top of their embed. They never need to
 * pass colors anywhere.
 */
import React from "react";
import { ThemeProvider, createTheme, useTheme as useMuiTheme } from "@mui/material";

export type ShuffleColorMode = "light" | "dark" | "auto";

const componentOverrides = {
  MuiTextField: { defaultProps: { size: "small" as const } },
  MuiButton: { defaultProps: { size: "small" as const } },
  MuiFormControl: { defaultProps: { size: "small" as const } },
  MuiSelect: { defaultProps: { size: "small" as const } },
  MuiAutocomplete: { defaultProps: { size: "small" as const } },
  MuiInputBase: {
    defaultProps: { size: "small" as const },
    styleOverrides: {
      root: { color: "hsl(var(--foreground))" },
      input: {
        color: "hsl(var(--foreground))",
        "&::placeholder": { color: "hsl(var(--muted-foreground))", opacity: 1 },
      },
    },
  },
  MuiInputLabel: {
    styleOverrides: {
      root: {
        color: "hsl(var(--muted-foreground))",
        "&.Mui-focused": { color: "hsl(var(--primary))" },
      },
    },
  },
  MuiFormLabel: {
    styleOverrides: {
      root: {
        color: "hsl(var(--muted-foreground))",
        "&.Mui-focused": { color: "hsl(var(--primary))" },
      },
    },
  },
  MuiTypography: {
    styleOverrides: {
      root: {
        color: "inherit",
        "&.MuiTypography-colorTextSecondary": { color: "hsl(var(--muted-foreground))" },
      },
    },
  },
  MuiDivider: {
    styleOverrides: {
      root: { borderColor: "hsl(var(--border))" },
    },
  },
  MuiCheckbox: {
    styleOverrides: {
      root: {
        color: "hsl(var(--muted-foreground))",
        "&.Mui-checked": { color: "hsl(var(--primary))" },
      },
    },
  },
  MuiOutlinedInput: {
    defaultProps: { size: "small" as const },
    styleOverrides: {
      root: {
        backgroundColor: "hsl(var(--input))",
        color: "hsl(var(--foreground))",
        borderRadius: 8,
        "& .MuiOutlinedInput-notchedOutline": { borderColor: "hsl(var(--border))" },
        "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "hsl(var(--border))" },
        "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "hsl(var(--primary))" },
        "&.Mui-disabled": {
          backgroundColor: "hsl(var(--muted))",
          color: "hsl(var(--muted-foreground))",
        },
      },
    },
  },
  MuiDrawer: {
    styleOverrides: {
      paper: {
        backgroundColor: "hsl(var(--sidebar-background))",
        color: "hsl(var(--sidebar-foreground))",
        borderColor: "hsl(var(--sidebar-border))",
      },
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: {
        backgroundImage: "none",
        backgroundColor: "hsl(var(--card))",
        color: "hsl(var(--card-foreground))",
      },
    },
  },
  MuiMenu: {
    styleOverrides: {
      paper: {
        backgroundColor: "hsl(var(--popover))",
        color: "hsl(var(--popover-foreground))",
        border: "1px solid hsl(var(--border))",
      },
    },
  },
  MuiPopover: {
    styleOverrides: {
      paper: {
        backgroundColor: "hsl(var(--popover))",
        color: "hsl(var(--popover-foreground))",
        border: "1px solid hsl(var(--border))",
      },
    },
  },
};

/** Read whether the host page is currently in dark mode. */
const readHtmlDarkClass = (): boolean => {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
};

/** Subscribe to changes on the html element's class list. */
const useHtmlDarkClass = (enabled: boolean): boolean => {
  const [isDark, setIsDark] = React.useState<boolean>(() => (enabled ? readHtmlDarkClass() : false));
  React.useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    setIsDark(readHtmlDarkClass());
    const observer = new MutationObserver(() => setIsDark(readHtmlDarkClass()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [enabled]);
  return isDark;
};

export interface ShuffleCoreThemeProviderProps {
  children: React.ReactNode;
  /**
   * Color mode for the wrapped subtree.
   * - `"auto"` (default) — follow the host page (`.dark` class on `<html>`).
   * - `"light"` / `"dark"` — pin the subtree to that scheme. Tailwind dark
   *   variants and CSS variable overrides are scoped via a wrapping `<div>`.
   */
  mode?: ShuffleColorMode;
}

export const ShuffleCoreThemeProvider: React.FC<ShuffleCoreThemeProviderProps> = ({
  children,
  mode = "auto",
}) => {
  const parent = useMuiTheme();
  const htmlIsDark = useHtmlDarkClass(mode === "auto");
  const effectiveDark = mode === "auto" ? htmlIsDark : mode === "dark";

  const merged = React.useMemo(
    () =>
      createTheme({
        ...parent,
        palette: {
          ...(parent as any).palette,
          mode: effectiveDark ? "dark" : "light",
        },
        components: {
          ...(parent as any).components,
          ...componentOverrides,
        },
      }),
    [parent, effectiveDark],
  );

  const tree = <ThemeProvider theme={merged}>{children}</ThemeProvider>;

  // For explicit modes, wrap in a div that scopes the `.dark` class so
  // Tailwind/CSS variable overrides apply to this subtree only.
  if (mode === "light" || mode === "dark") {
    return (
      <div className={mode === "dark" ? "dark" : ""} data-shuffle-mode={mode}>
        {tree}
      </div>
    );
  }
  return tree;
};

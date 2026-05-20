/**
 * ShuffleMcpThemeProvider
 *
 * Mirror of Shuffle-Core's theme provider, scoped for the Shuffle-MCPs lib.
 * Two jobs:
 *
 * 1. Pin MUI defaults (`size="small"`) so individual call sites never need to
 *    thread sizing through.
 *
 * 2. Bridge the host app's light/dark scheme into MUI:
 *    - `mode="auto"` (default) — track the `.dark` class on `<html>` and flip
 *      MUI `palette.mode` accordingly. Tokens (`hsl(var(--…))`) flip with the
 *      same class so nothing else needs to know about the theme.
 *    - `mode="light" | "dark"` — pin the wrapped subtree to that scheme. We
 *      render a `<div className="dark">` (or remove it) so Tailwind dark
 *      variants and CSS-variable overrides scope to this subtree only —
 *      useful when embedding MCPs inside a host that doesn't manage `.dark`
 *      on `<html>`.
 *
 * Wrap your MCP usage at any level:
 *
 *     <ShuffleMcpThemeProvider mode="dark">
 *       <ShuffleMCP ... />
 *     </ShuffleMcpThemeProvider>
 */
import React from "react";
import { ThemeProvider, createTheme, useTheme as useMuiTheme } from "@mui/material";

export type ShuffleMcpColorMode = "light" | "dark" | "auto";

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
  MuiDivider: {
    styleOverrides: { root: { borderColor: "hsl(var(--border))" } },
  },
};

const readHtmlDarkClass = (): boolean => {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
};

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

export interface ShuffleMcpThemeProviderProps {
  children: React.ReactNode;
  /**
   * Color mode for the wrapped subtree.
   * - `"auto"` (default) — follow the host page's `.dark` class on `<html>`.
   * - `"light"` / `"dark"` — pin the subtree to that scheme via a wrapping div.
   */
  mode?: ShuffleMcpColorMode;
}

export const ShuffleMcpThemeProvider: React.FC<ShuffleMcpThemeProviderProps> = ({
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

  if (mode === "light" || mode === "dark") {
    return (
      <div className={mode === "dark" ? "dark" : ""} data-shuffle-mode={mode}>
        {tree}
      </div>
    );
  }
  return tree;
};

export default ShuffleMcpThemeProvider;

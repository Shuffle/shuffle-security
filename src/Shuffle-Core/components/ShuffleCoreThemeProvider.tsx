/**
 * ShuffleCoreThemeProvider
 *
 * - Pins MUI component defaults (`size="small"`).
 * - Bridges the host app's light/dark scheme into MUI (`palette.mode`) and
 *   into our HSL token system (scoped `.dark` class).
 * - Exposes `ShuffleCoreThemeContext` so internal raw components — and
 *   views that compose other Shuffle-Core components without going through
 *   the public wrapped exports — see the resolved mode.
 * - Stamps the scope className onto MUI portaled paper (Drawer, Dialog,
 *   Menu, Popover, Tooltip), so portals rendered into <body> still resolve
 *   our `hsl(var(--…))` tokens against the pinned theme.
 */
import React from "react";
import { ThemeProvider, createTheme, useTheme as useMuiTheme } from "@mui/material";
// Pull in the Shuffle-Core HSL token stylesheet so ANY consumer that wraps
// itself in this provider (or imports anything that does — e.g.
// `@/Shuffle-Core/onboarding`) automatically gets `.shuffle-core-scope[.dark]`
// tokens. Previously only `src/Shuffle-Core/index.tsx` imported the CSS, so
// sub-entry points like `onboarding/index.tsx` rendered unstyled when the
// host hadn't separately loaded it. Bundlers de-dupe the import.
import "../shuffle-core.css";


export type ShuffleColorMode = "light" | "dark" | "auto";

const readHtmlDarkClass = (): boolean => {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
};

/**
 * Resolve "auto" theme by inspecting the nearest ancestor that already
 * declares a Shuffle theme scope. Makes a pinned scope cascade across the
 * Shuffle-Core / Shuffle-MCPs package boundary (React context can't, since
 * each package ships its own copy).
 */
const readAncestorDark = (anchor: Element | null): boolean | null => {
  if (!anchor || typeof document === "undefined") return null;
  const start = anchor.parentElement;
  if (!start) return null;
  const scoped = start.closest('[data-shuffle-mode="dark"], [data-shuffle-mode="light"]');
  if (scoped) return scoped.getAttribute("data-shuffle-mode") === "dark";
  const darkAncestor = start.closest(".dark");
  if (darkAncestor) return true;
  return null;
};

const useAutoDarkClass = (enabled: boolean, anchorRef: React.RefObject<HTMLElement>): boolean => {
  const [isDark, setIsDark] = React.useState<boolean>(() => (enabled ? readHtmlDarkClass() : false));
  React.useLayoutEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const recompute = () => {
      const ancestor = readAncestorDark(anchorRef.current);
      setIsDark(ancestor !== null ? ancestor : readHtmlDarkClass());
    };
    recompute();
    const observer = new MutationObserver(recompute);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    let node: HTMLElement | null = anchorRef.current?.parentElement ?? null;
    while (node) {
      observer.observe(node, { attributes: true, attributeFilter: ["class", "data-shuffle-mode"] });
      node = node.parentElement;
    }
    return () => observer.disconnect();
  }, [enabled, anchorRef]);
  return isDark;
};

interface ShuffleCoreThemeContextValue {
  mode: ShuffleColorMode;
  isDark: boolean;
  scopeClassName: string;
}

export const ShuffleCoreThemeContext = React.createContext<ShuffleCoreThemeContextValue | null>(null);

export const useShuffleCoreTheme = (): ShuffleCoreThemeContextValue | null =>
  React.useContext(ShuffleCoreThemeContext);

const buildComponentOverrides = (scopeClassName: string) => ({
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
    styleOverrides: { root: { borderColor: "hsl(var(--border))" } },
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
    defaultProps: { slotProps: { paper: { className: scopeClassName } } },
    styleOverrides: {
      paper: {
        backgroundColor: "hsl(var(--sidebar-background))",
        color: "hsl(var(--sidebar-foreground))",
        borderColor: "hsl(var(--sidebar-border))",
      },
    },
  },
  MuiDialog: {
    defaultProps: { slotProps: { paper: { className: scopeClassName } } },
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
    defaultProps: { slotProps: { paper: { className: scopeClassName } } },
    styleOverrides: {
      paper: {
        backgroundColor: "hsl(var(--popover))",
        color: "hsl(var(--popover-foreground))",
        border: "1px solid hsl(var(--border))",
      },
    },
  },
  MuiPopover: {
    defaultProps: { slotProps: { paper: { className: scopeClassName } } },
    styleOverrides: {
      paper: {
        backgroundColor: "hsl(var(--popover))",
        color: "hsl(var(--popover-foreground))",
        border: "1px solid hsl(var(--border))",
      },
    },
  },
  MuiTooltip: {
    defaultProps: { slotProps: { tooltip: { className: scopeClassName } } },
  },
});

export interface ShuffleCoreThemeProviderProps {
  children: React.ReactNode;
  /**
   * - `"auto"` (default) — follow the host page's `.dark` class on `<html>`.
   * - `"light"` / `"dark"` — pin the subtree (and portals from within it).
   */
  mode?: ShuffleColorMode;
}

export const ShuffleCoreThemeProvider: React.FC<ShuffleCoreThemeProviderProps> = ({
  children,
  mode = "auto",
}) => {
  const parent = useMuiTheme();
  const parentCtx = useShuffleCoreTheme();
  const anchorRef = React.useRef<HTMLSpanElement>(null);
  const autoIsDark = useAutoDarkClass(mode === "auto", anchorRef);
  const effectiveDark = mode === "auto" ? autoIsDark : mode === "dark";

  const sameAsParent =
    parentCtx !== null && parentCtx.isDark === effectiveDark;

  const scopeClassName = effectiveDark ? "shuffle-core-scope dark" : "shuffle-core-scope";
  const resolvedModeAttr = effectiveDark ? "dark" : "light";

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
          ...buildComponentOverrides(scopeClassName),
        },
      }),
    [parent, effectiveDark, scopeClassName],
  );

  const ctxValue = React.useMemo<ShuffleCoreThemeContextValue>(
    () => ({ mode, isDark: effectiveDark, scopeClassName }),
    [mode, effectiveDark, scopeClassName],
  );

  if (sameAsParent) {
    return (
      <ShuffleCoreThemeContext.Provider value={ctxValue}>
        <span ref={anchorRef} style={{ display: "none" }} aria-hidden />
        {children}
      </ShuffleCoreThemeContext.Provider>
    );
  }

  return (
    <ShuffleCoreThemeContext.Provider value={ctxValue}>
      <ThemeProvider theme={merged}>
        <div className={scopeClassName} data-shuffle-mode={resolvedModeAttr} data-shuffle-core-root>
          <span ref={anchorRef} style={{ display: "none" }} aria-hidden />
          {children}
        </div>
      </ThemeProvider>
    </ShuffleCoreThemeContext.Provider>
  );
};

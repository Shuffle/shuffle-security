/**
 * ShuffleCoreThemeProvider
 *
 * Pins MUI component defaults so Shuffle-Core's TextField / Button / Select /
 * FormControl / Autocomplete all render at `size="small"` — matching the rest
 * of Shuffle Security (36px buttons, ~38px text fields). Wrap any Shuffle-Core
 * view/component root in this so we never have to thread `size="small"` through
 * every call site.
 */
import React from "react";
import { ThemeProvider, createTheme, useTheme as useMuiTheme } from "@mui/material";

const shuffleCoreTheme = createTheme({
  components: {
    MuiTextField: { defaultProps: { size: "small" } },
    MuiButton: { defaultProps: { size: "small" } },
    MuiFormControl: { defaultProps: { size: "small" } },
    MuiSelect: { defaultProps: { size: "small" } },
    MuiAutocomplete: { defaultProps: { size: "small" } },
    MuiInputBase: {
      defaultProps: { size: "small" },
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
      defaultProps: { size: "small" },
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
  },
});

export const ShuffleCoreThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Inherit from the host app's theme so palette/typography aren't lost —
  // we only override component defaults (sizes).
  const parent = useMuiTheme();
  const merged = React.useMemo(
    () => createTheme({ ...parent, components: { ...(parent as any).components, ...shuffleCoreTheme.components } }),
    [parent],
  );
  return <ThemeProvider theme={merged}>{children}</ThemeProvider>;
};

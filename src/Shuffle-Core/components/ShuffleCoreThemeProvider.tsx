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
import { ThemeProvider, createTheme, useTheme as useMuiTheme } from "@mui/material/styles";

const shuffleCoreTheme = createTheme({
  components: {
    MuiTextField: { defaultProps: { size: "small" } },
    MuiButton: { defaultProps: { size: "small" } },
    MuiFormControl: { defaultProps: { size: "small" } },
    MuiSelect: { defaultProps: { size: "small" } },
    MuiAutocomplete: { defaultProps: { size: "small" } },
    MuiOutlinedInput: { defaultProps: { size: "small" } },
    MuiInputBase: { defaultProps: { size: "small" } },
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

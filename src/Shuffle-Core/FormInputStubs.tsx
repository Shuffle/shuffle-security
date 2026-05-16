// @ts-nocheck
/**
 * Local stubs for FormInput.tsx (ported from RunWorkflow.jsx).
 *
 * These replace internal Shuffle Core modules that are NOT yet ported into
 * this library. Behavior may differ from production:
 *  - EditWorkflow:   no-op modal (cannot create/edit workflows here)
 *  - RecentWorkflow: not rendered (recent workflows list missing)
 *  - ReactJson:      replaced by <pre> JSON dump (no expand/collapse UI)
 *  - rehypeRaw:      undefined (raw HTML inside markdown will be escaped)
 *  - GetIconInfo:    returns null (app icons may not show)
 *  - collapseField:  identity function (no field collapsing)
 *  - AngularWorkflow colors: simple HSL semantic fallbacks
 *  - Docs helpers (CodeHandler/Img/OuterLink): minimal HTML fallbacks
 *  - Context:        only exposes themeMode/brandColor/supportEmail defaults
 *  - useInterval:    minimal { start, stop } shim
 *  - isMobile:       basic UA sniff
 */
import React from "react";

export const green = "hsl(140 60% 45%)";
export const yellow = "hsl(45 90% 55%)";
export const red = "hsl(0 75% 55%)";
export const grey = "hsl(0 0% 60%)";

export const CodeHandler = ({ value, language }: any) => (
  <pre style={{ background: "hsl(var(--muted))", padding: 12, borderRadius: 6, overflow: "auto" }}>
    <code>{String(value ?? "")}</code>
  </pre>
);
export const Img = (props: any) => <img {...props} alt={props?.alt || ""} />;
export const OuterLink = ({ href, children, ...rest }: any) => (
  <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>{children}</a>
);

export const validateJson = (input: any) => {
  try {
    if (typeof input === "string") {
      const parsed = JSON.parse(input);
      return { valid: true, result: parsed };
    }
    return { valid: true, result: input };
  } catch (e) {
    return { valid: false, result: input };
  }
};

export const collapseField = (value: any) => value;

export const GetIconInfo = (_app: any) => null;

const EditWorkflow: React.FC<any> = ({ modalOpen }) => {
  if (!modalOpen) return null;
  return null; // Stub: workflow editor not available in this library
};
export default EditWorkflow;

export const RecentWorkflow: React.FC<any> = () => null;

export const ReactJson: React.FC<any> = (props) => (
  <pre
    style={{
      background: "hsl(var(--muted))",
      color: "hsl(var(--foreground))",
      padding: 12,
      borderRadius: 6,
      maxHeight: 400,
      overflow: "auto",
      fontSize: 12,
    }}
  >
    {(() => {
      try { return JSON.stringify(props?.src, null, 2); }
      catch { return String(props?.src); }
    })()}
  </pre>
);

export const Context = React.createContext<any>({
  themeMode: "dark",
  brandColor: "#FF6600",
  supportEmail: "support@shuffler.io",
});

// react-powerhooks useInterval shim
export const useInterval = ({ duration, callback }: { duration: number; callback: () => void }) => {
  const ref = React.useRef<any>(null);
  const start = React.useCallback(() => {
    if (ref.current) return;
    ref.current = setInterval(callback, duration);
  }, [callback, duration]);
  const stop = React.useCallback(() => {
    if (ref.current) { clearInterval(ref.current); ref.current = null; }
  }, []);
  React.useEffect(() => () => stop(), [stop]);
  return { start, stop };
};

export const isMobile =
  typeof navigator !== "undefined" &&
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || "");

// theme.jsx stub
export const getTheme = (themeMode: string = "dark", brandColor: string = "#FF6600") => ({
  palette: {
    mode: themeMode,
    primaryColor: brandColor,
    secondary: brandColor,
    inputColor: "hsl(var(--input))",
    surfaceColor: "hsl(var(--card))",
    backgroundColor: "hsl(var(--background))",
    textColor: "hsl(var(--foreground))",
    borderRadius: 8,
    defaultImage: "",
    jsonTheme: "monokai",
    reactJsonStyle: { padding: 12, borderRadius: 6 },
    jsonIconStyle: "circle",
    jsonCollapseStringsAfterLength: 100,
    textFieldStyle: {},
  },
});

// ReactDOM.unstable_batchedUpdates fallback for React 18
export const ReactDOMShim = {
  unstable_batchedUpdates: (fn: () => void) => fn(),
};

import * as React from "react";
import { motion, LayoutGroup } from "framer-motion";

/**
 * SegmentedControl
 *
 * iOS-style pill with a smoothly sliding active background (shared layoutId).
 * Items can be tabs (`type: 'tab'`, default) OR action buttons
 * (`type: 'action'`) — actions just fire onClick and never become "active".
 * A vertical divider can be inserted with `{ type: 'divider' }`.
 *
 * Use this anywhere we need filter tabs (All • Public • Private) or a
 * mixed pill like Start • Simple • Detailed | Reload Schedule.
 */

export type SegmentedItem<V extends string = string> =
  | {
      type?: "tab";
      value: V;
      label: React.ReactNode;
      count?: number;
      title?: string;
      disabled?: boolean;
      dataTour?: string;
    }
  | {
      type: "action";
      /** Stable key, required since `value` is absent. */
      key: string;
      label: React.ReactNode;
      title?: string;
      disabled?: boolean;
      onClick: () => void;
      dataTour?: string;
    }
  | {
      type: "divider";
      key?: string;
    };

// Back-compat alias.
export type SegmentedOption<V extends string = string> = SegmentedItem<V>;

export interface SegmentedControlProps<V extends string = string> {
  options: SegmentedItem<V>[];
  value: V;
  onChange: (value: V) => void;
  size?: "sm" | "md";
  /**
   * Visual style:
   * - "outline" (default): transparent track + hairline border, filled active pill.
   * - "filled": subtly filled track + no border, filled active pill (iOS-style).
   */
  variant?: "outline" | "filled";
  className?: string;
  ariaLabel?: string;
  /** Unique id so multiple segmented controls on a page do not share their pill. */
  layoutId?: string;
}

const sizeClasses = {
  sm: {
    container: { padding: 2, fontSize: 11 },
    item: { padding: "4px 10px", gap: 6 },
    count: { minWidth: 16, height: 16, padding: "0 4px", fontSize: 10 },
    divider: { height: 16, margin: "0 2px" },
  },
  md: {
    container: { padding: 4, fontSize: 12 },
    item: { padding: "6px 12px", gap: 6 },
    count: { minWidth: 18, height: 18, padding: "0 6px", fontSize: 10 },
    divider: { height: 20, margin: "0 4px" },
  },
};

let uid = 0;
function useUniqueId(prefix: string) {
  const ref = React.useRef<string>();
  if (!ref.current) {
    uid += 1;
    ref.current = `${prefix}-${uid}`;
  }
  return ref.current;
}

export function SegmentedControl<V extends string = string>({
  options,
  value,
  onChange,
  size = "md",
  variant = "outline",
  className,
  ariaLabel,
  layoutId,
}: SegmentedControlProps<V>) {
  const autoId = useUniqueId("segmented");
  const groupId = layoutId ?? autoId;
  const s = sizeClasses[size];

  const trackStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 2,
    borderRadius: 999,
    border: variant === "outline" ? "1px solid hsl(var(--border))" : "1px solid transparent",
    backgroundColor: variant === "outline" ? "transparent" : "hsl(var(--muted) / 0.4)",
    color: "hsl(var(--muted-foreground))",
    ...s.container,
  };

  return (
    <LayoutGroup id={groupId}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={className}
        style={trackStyle}
      >
        {options.map((opt, i) => {
          if (opt.type === "divider") {
            return (
              <span
                key={opt.key ?? `divider-${i}`}
                aria-hidden
                style={{ width: 1, alignSelf: "center", backgroundColor: "hsl(var(--border))", ...s.divider }}
              />
            );
          }

          const isAction = opt.type === "action";
          const active = !isAction && opt.value === value;
          const key = isAction ? opt.key : opt.value;

          return (
            <button
              key={key}
              type="button"
              data-tour={opt.dataTour}
              role={isAction ? "button" : "tab"}
              aria-selected={isAction ? undefined : active}
              title={opt.title}
              disabled={opt.disabled}
              onClick={() => {
                if (opt.disabled) return;
                if (isAction) opt.onClick();
                else onChange(opt.value);
              }}
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                border: 0,
                borderRadius: 999,
                background: "transparent",
                color: active ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                font: "inherit",
                fontWeight: 500,
                cursor: opt.disabled ? "not-allowed" : "pointer",
                opacity: opt.disabled ? 0.5 : 1,
                transition: "color 300ms ease",
                ...s.item,
              }}
              onMouseEnter={(event) => {
                if (!active && !opt.disabled) event.currentTarget.style.color = "hsl(var(--foreground))";
              }}
              onMouseLeave={(event) => {
                if (!active) event.currentTarget.style.color = "hsl(var(--muted-foreground))";
              }}
            >
              {active && (
                <motion.span
                  layoutId={`${groupId}-pill`}
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 999,
                    backgroundColor: "hsl(var(--muted))",
                    border: "1px solid hsl(var(--border))",
                  }}
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 30,
                  }}
                />
              )}
              <span style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", gap: 6 }}>
                {opt.label}
              </span>
              {!isAction && typeof opt.count === "number" && (
                <span
                  style={{
                    position: "relative",
                    zIndex: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 6,
                    border: "1px solid hsl(var(--border) / 0.6)",
                    background: "transparent",
                    color: active ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                    ...s.count,
                  }}
                >
                  {opt.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

export default SegmentedControl;

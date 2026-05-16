import * as React from "react";
import { motion, LayoutGroup } from "framer-motion";
import { cn } from "@/lib/utils";

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
    container: "p-0.5 text-[11px]",
    item: "px-2.5 py-1 gap-1.5",
    count: "min-w-[16px] h-[16px] px-1 text-[10px]",
    divider: "h-4 mx-0.5",
  },
  md: {
    container: "p-1 text-xs",
    item: "px-3 py-1.5 gap-1.5",
    count: "min-w-[18px] h-[18px] px-1.5 text-[10px]",
    divider: "h-5 mx-1",
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
  className,
  ariaLabel,
  layoutId,
}: SegmentedControlProps<V>) {
  const autoId = useUniqueId("segmented");
  const groupId = layoutId ?? autoId;
  const s = sizeClasses[size];

  return (
    <LayoutGroup id={groupId}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full border border-border bg-transparent",
          s.container,
          className,
        )}
      >
        {options.map((opt, i) => {
          if (opt.type === "divider") {
            return (
              <span
                key={opt.key ?? `divider-${i}`}
                aria-hidden
                className={cn("w-px bg-border self-center", s.divider)}
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
              className={cn(
                "relative inline-flex items-center rounded-full font-medium",
                "transition-colors duration-300",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                s.item,
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
                opt.disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              {active && (
                <motion.span
                  layoutId={`${groupId}-pill`}
                  className="absolute inset-0 rounded-full bg-muted border border-border"
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 30,
                  }}
                />
              )}
              <span className="relative z-10 inline-flex items-center gap-1.5">
                {opt.label}
              </span>
              {!isAction && typeof opt.count === "number" && (
                <span
                  className={cn(
                    "relative z-10 inline-flex items-center justify-center rounded-md font-semibold tabular-nums border border-border/60",
                    s.count,
                    active
                      ? "bg-transparent text-foreground"
                      : "bg-transparent text-muted-foreground",
                  )}
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

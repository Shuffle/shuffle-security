import * as React from "react";
import { motion, LayoutGroup } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * SegmentedControl
 *
 * A reusable iOS-style segmented control where the active "pill" smoothly
 * slides/morphs between options using a shared layoutId. Supports an optional
 * count badge per option (chip-in-chip).
 *
 * Use this anywhere we need filter tabs like: All • Public • Private, or
 * All • Ignored, etc. One standard component to optimise everywhere.
 */

export interface SegmentedOption<V extends string = string> {
  value: V;
  label: React.ReactNode;
  count?: number;
  title?: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<V extends string = string> {
  options: SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  size?: "sm" | "md";
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
  },
  md: {
    container: "p-1 text-xs",
    item: "px-3 py-1.5 gap-1.5",
    count: "min-w-[18px] h-[18px] px-1.5 text-[10px]",
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
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={active}
              title={opt.title}
              disabled={opt.disabled}
              onClick={() => !opt.disabled && onChange(opt.value)}
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
                  className="absolute inset-0 rounded-full bg-card border border-border"
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 260,
                    damping: 30,
                  }}
                />
              )}
              <span className="relative z-10">{opt.label}</span>
              {typeof opt.count === "number" && (
                <span
                  className={cn(
                    "relative z-10 inline-flex items-center justify-center rounded-md font-semibold tabular-nums border border-border/60",
                    s.count,
                    active
                      ? "bg-background/60 text-foreground"
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

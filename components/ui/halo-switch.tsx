"use client";

// Cult UI — Halo Switch (https://www.cult-ui.com/docs/components/halo-switch)
// Uyarlama: Vercel tarzı pembe/mor/camgöbeği gradyan yerine Axis altın (--brand) tonları.
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
  type RefCallback,
} from "react";
import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

const layoutSpring = {
  type: "spring" as const,
  bounce: 0.12,
  damping: 34,
  stiffness: 420,
};

/** Thumb ile ray kenarı arasındaki yatay boşluk (`px-[3px]` ile aynı olmalı). */
const TRACK_PAD_X_PX = 3;

function approximateTravelPx(size: "sm" | "default") {
  const trackW = size === "sm" ? 34 : 40;
  const thumbW = size === "sm" ? 12 : 14;
  return Math.max(0, trackW - thumbW - TRACK_PAD_X_PX * 2);
}

function mergeRefs<T>(...refs: (Ref<T> | undefined)[]) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (ref == null) continue;
      if (typeof ref === "function") {
        (ref as RefCallback<T>)(node);
      } else {
        (ref as { current: T | null }).current = node;
      }
    }
  };
}

export interface HaloSwitchProps extends SwitchPrimitive.Root.Props {
  /** Buzlu kabuk + altın alt parıltı */
  translucent?: boolean;
  size?: "sm" | "default";
}

export function HaloSwitch({
  className,
  translucent = true,
  size = "default",
  checked: checkedProp,
  defaultChecked,
  onCheckedChange,
  disabled,
  ...rootProps
}: HaloSwitchProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const trackRef = useRef<HTMLSpanElement | null>(null);
  const thumbRef = useRef<HTMLSpanElement | null>(null);
  const [thumbTravel, setThumbTravel] = useState(() => approximateTravelPx(size));

  const isControlled = checkedProp !== undefined;
  const [, setUncontrolled] = useState(Boolean(defaultChecked));

  const measure = useCallback(() => {
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!(track && thumb)) return;
    const hw = thumb.getBoundingClientRect().width;
    const styles = getComputedStyle(track);
    const padX = Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
    setThumbTravel(Math.max(0, track.clientWidth - padX - hw));
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(track);
    return () => ro.disconnect();
  }, [measure]);

  const handleCheckedChange = useCallback(
    (next: boolean, details: Parameters<NonNullable<typeof onCheckedChange>>[1]) => {
      if (!isControlled) setUncontrolled(next);
      onCheckedChange?.(next, details);
    },
    [isControlled, onCheckedChange]
  );

  const thumbSize = size === "sm" ? "size-3 min-h-3 min-w-3" : "size-3.5 min-h-3.5 min-w-3.5";
  const trackSize =
    size === "sm" ? "h-[18px] min-h-[18px] w-[34px] min-w-[34px]" : "h-[22px] min-h-[22px] w-10 min-w-[40px]";
  /** `::after` dokunma alanını ≥44px'e genişletir. */
  const hitAfterY = size === "sm" ? "after:-inset-y-[13px]" : "after:-inset-y-[11px]";

  return (
    <div className={cn("relative inline-flex max-w-full rounded-[9999px]", className)}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[9999px]">
        {translucent ? (
          <div
            className={cn("absolute inset-0 blur-xl", reduceMotion ? "opacity-[0.38]" : "opacity-50")}
            style={{
              background:
                "radial-gradient(90% 70% at 50% 100%, color-mix(in oklch, var(--brand) 35%, transparent), transparent 62%)",
            }}
          />
        ) : null}
      </div>

      <div
        className={cn(
          "relative rounded-[9999px] border border-border bg-card",
          "shadow-[0_1px_0_rgba(255,255,255,0.55)_inset,0_1px_2px_rgba(0,0,0,0.03),0_6px_18px_rgba(0,0,0,0.04)]",
          "dark:shadow-[0_1px_0_rgba(255,255,255,0.05)_inset,0_1px_2px_rgba(0,0,0,0.28),0_6px_22px_rgba(0,0,0,0.32)]",
          translucent && "backdrop-blur-xl backdrop-saturate-150"
        )}
      >
        <SwitchPrimitive.Root
          {...rootProps}
          checked={isControlled ? checkedProp : undefined}
          className={cn(
            "group/switch relative isolate flex shrink-0 cursor-pointer flex-row items-center justify-start rounded-[9999px] border border-transparent px-[3px] outline-none",
            "transition-[background,box-shadow] duration-200 ease-out",
            "after:pointer-events-auto after:absolute after:-inset-x-3 after:z-0 after:rounded-[9999px] after:bg-transparent after:content-['']",
            hitAfterY,
            "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
            "data-unchecked:bg-muted dark:data-unchecked:bg-input",
            "data-checked:bg-[linear-gradient(180deg,color-mix(in_oklch,var(--brand)_80%,white)_0%,var(--brand)_100%)]",
            "data-disabled:cursor-not-allowed data-disabled:opacity-50",
            trackSize
          )}
          data-size={size}
          data-slot="halo-switch"
          defaultChecked={isControlled ? undefined : defaultChecked}
          disabled={disabled}
          onCheckedChange={handleCheckedChange}
          ref={trackRef}
        >
          <SwitchPrimitive.Thumb
            data-slot="halo-switch-thumb"
            render={(thumbProps, thumbState) => {
              const {
                className: thumbClassName,
                ref: thumbRefProp,
                style: thumbStyle,
                // Motion API'leriyle aynı adı taşıyan ama tipleri uyuşmayan DOM olayları.
                onDrag: _onDrag,
                onDragStart: _onDragStart,
                onDragEnd: _onDragEnd,
                onAnimationStart: _onAnimationStart,
                onAnimationEnd: _onAnimationEnd,
                ...thumbRest
              } = thumbProps;
              const { transform: _, ...thumbStyleSafe } = (thumbStyle ?? {}) as CSSProperties;
              return (
                <motion.span
                  {...thumbRest}
                  animate={{ x: thumbState.checked ? thumbTravel : 0 }}
                  className={cn(
                    thumbClassName,
                    "pointer-events-none relative z-1 box-border block shrink-0 rounded-full bg-background",
                    thumbSize,
                    "shadow-[0_1px_0_rgba(255,255,255,0.85)_inset,0_1px_2px_rgba(0,0,0,0.07),0_2px_10px_rgba(0,0,0,0.05)]",
                    "ring-1 ring-black/8 dark:ring-white/12",
                    "dark:shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_1px_3px_rgba(0,0,0,0.45),0_2px_12px_rgba(0,0,0,0.35)]",
                    "data-checked:bg-white dark:data-unchecked:bg-foreground/85"
                  )}
                  initial={false}
                  ref={mergeRefs(thumbRefProp, thumbRef)}
                  style={{ ...thumbStyleSafe, willChange: reduceMotion ? undefined : "transform" }}
                  transition={reduceMotion ? { duration: 0 } : layoutSpring}
                  whileTap={reduceMotion ? undefined : { scale: 0.96 }}
                />
              );
            }}
          />
        </SwitchPrimitive.Root>
      </div>
    </div>
  );
}

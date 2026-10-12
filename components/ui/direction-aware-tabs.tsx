"use client";

// Cult UI — Direction Aware Tabs (https://www.cult-ui.com/docs/components/direction-aware-tabs)
// Uyarlama: kontrollü kullanım (value/onValueChange), ReactNode etiketler, isteğe bağlı içerik
// ve Axis tema token'ları (neutral-* yerine background/foreground).
import { ReactNode, useId, useMemo, useState } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import useMeasure from "react-use-measure";

import { cn } from "@/lib/utils";

type Tab<T extends string | number> = {
  id: T;
  label: ReactNode;
  content?: ReactNode;
};

interface DirectionAwareTabsProps<T extends string | number> {
  tabs: Tab<T>[];
  value?: T;
  defaultValue?: T;
  onValueChange?: (id: T) => void;
  className?: string;
  /** Dış kapsayıcı yarıçapı (örn. `rounded-lg`) */
  rounded?: string;
  /** İç sekme/kabarcık yarıçapı — dış yarıçaptan kapsayıcı dolgusu kadar küçük olmalı */
  roundedInner?: string;
  tabClassName?: string;
}

function DirectionAwareTabs<T extends string | number>({
  tabs,
  value,
  defaultValue,
  onValueChange,
  className,
  rounded,
  roundedInner,
  tabClassName,
}: DirectionAwareTabsProps<T>) {
  const bubbleId = useId();
  const [internal, setInternal] = useState<T>(defaultValue ?? tabs[0].id);
  const activeTab = value ?? internal;
  const [direction, setDirection] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [ref, bounds] = useMeasure();

  const indexOf = (id: T) => tabs.findIndex((tab) => tab.id === id);
  const hasContent = tabs.some((tab) => tab.content !== undefined);

  const content = useMemo(() => {
    return tabs.find((tab) => tab.id === activeTab)?.content || null;
  }, [activeTab, tabs]);

  const handleTabClick = (newTabId: T) => {
    if (newTabId !== activeTab && !isAnimating) {
      setDirection(indexOf(newTabId) > indexOf(activeTab) ? 1 : -1);
      if (value === undefined) setInternal(newTabId);
      onValueChange?.(newTabId);
    }
  };

  const variants = {
    initial: (direction: number) => ({
      x: 300 * direction,
      opacity: 0,
      filter: "blur(4px)",
    }),
    active: {
      x: 0,
      opacity: 1,
      filter: "blur(0px)",
    },
    exit: (direction: number) => ({
      x: -300 * direction,
      opacity: 0,
      filter: "blur(4px)",
    }),
  };

  return (
    <div className="flex w-full flex-col items-center">
      <div
        role="tablist"
        className={cn(
          "flex w-full cursor-pointer gap-1 rounded-full bg-muted px-[3px] py-[3.2px] ring-1 ring-foreground/10",
          className,
          rounded
        )}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              activeTab === tab.id ? "text-background" : "text-muted-foreground hover:text-foreground",
              rounded ? roundedInner : undefined,
              tabClassName
            )}
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            {activeTab === tab.id && (
              <motion.span
                layoutId={`bubble-${bubbleId}`}
                className={cn("absolute inset-0 z-0 bg-foreground shadow-xs", rounded ? roundedInner : "rounded-full")}
                transition={{ type: "spring", bounce: 0.19, duration: 0.4 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">{tab.label}</span>
          </button>
        ))}
      </div>
      {hasContent && (
        <MotionConfig transition={{ duration: 0.4, type: "spring", bounce: 0.2 }}>
          <motion.div
            className="relative mx-auto h-full w-full overflow-hidden"
            initial={false}
            animate={{ height: bounds.height }}
          >
            <div className="p-1" ref={ref}>
              <AnimatePresence custom={direction} mode="popLayout" onExitComplete={() => setIsAnimating(false)}>
                <motion.div
                  key={String(activeTab)}
                  variants={variants}
                  initial="initial"
                  animate="active"
                  exit="exit"
                  custom={direction}
                  onAnimationStart={() => setIsAnimating(true)}
                  onAnimationComplete={() => setIsAnimating(false)}
                >
                  {content}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </MotionConfig>
      )}
    </div>
  );
}

export { DirectionAwareTabs };

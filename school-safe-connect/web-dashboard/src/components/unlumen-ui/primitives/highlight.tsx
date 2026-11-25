"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type HighlightContextValue = {
  hoveredRect: DOMRect | null;
  setHoveredRect: (rect: DOMRect | null) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  hover: boolean;
};

const HighlightContext = React.createContext<HighlightContextValue | null>(null);

export interface HighlightProps extends React.HTMLAttributes<HTMLDivElement> {
  mode?: "parent" | "standalone";
  controlledItems?: boolean;
  hover?: boolean;
  containerClassName?: string;
}

export function Highlight({
  mode = "parent",
  controlledItems = false,
  hover = true,
  className,
  containerClassName,
  children,
  style,
  ...props
}: HighlightProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [hoveredRect, setHoveredRect] = React.useState<DOMRect | null>(null);

  return (
    <HighlightContext.Provider
      value={{
        hoveredRect,
        setHoveredRect,
        containerRef,
        hover,
      }}
    >
      <div
        ref={containerRef}
        className={cn("relative", containerClassName)}
        onMouseLeave={() => setHoveredRect(null)}
        {...props}
      >
        <AnimatePresence>
          {hoveredRect && containerRef.current && (
            <motion.div
              layoutId="highlight-pill"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{
                opacity: 1,
                scale: 1,
                x: hoveredRect.left - containerRef.current.getBoundingClientRect().left,
                y: hoveredRect.top - containerRef.current.getBoundingClientRect().top,
                width: hoveredRect.width,
                height: hoveredRect.height,
              }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 30,
              }}
              className={cn("absolute pointer-events-none rounded-md", className)}
              style={style}
            />
          )}
        </AnimatePresence>
        {children}
      </div>
    </HighlightContext.Provider>
  );
}

export interface HighlightItemProps {
  children: React.ReactElement;
  asChild?: boolean;
}

export function HighlightItem({ children, asChild }: HighlightItemProps) {
  const context = React.useContext(HighlightContext);
  const childRef = React.useRef<HTMLElement | null>(null);

  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    if (context && context.hover) {
      const rect = e.currentTarget.getBoundingClientRect();
      context.setHoveredRect(rect);
    }
    if (children.props.onMouseEnter) {
      children.props.onMouseEnter(e);
    }
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onMouseEnter: handleMouseEnter,
    });
  }

  return (
    <div onMouseEnter={handleMouseEnter} className="inline-block">
      {children}
    </div>
  );
}

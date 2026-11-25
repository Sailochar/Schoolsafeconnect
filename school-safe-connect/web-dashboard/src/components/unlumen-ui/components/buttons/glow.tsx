"use client";

import * as React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

export interface GlowButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  colors?: string[];
  glowSize?: number;
  glowBlur?: number;
  glowOpacity?: number;
  containerClassName?: string;
}

export const GlowButton = React.forwardRef<HTMLButtonElement, GlowButtonProps>(
  (
    {
      colors = ["#FF5733", "#33FF57", "#3357FF", "#F1C40F"],
      glowSize = 2,
      glowBlur = 18,
      glowOpacity = 0.85,
      className,
      containerClassName,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const gradientColors = colors.length > 0 ? colors.join(", ") : "#3b82f6, #8b5cf6, #ec4899";
    const gradientStyle = `linear-gradient(135deg, ${gradientColors}, ${colors[0] || "#3b82f6"})`;

    return (
      <div className={cn("relative inline-flex group isolate", containerClassName)}>
        {/* Animated Glow Backdrop */}
        {!disabled && (
          <motion.div
            aria-hidden="true"
            className="absolute -inset-1 rounded-xl opacity-70 group-hover:opacity-100 transition-opacity duration-500 blur-lg pointer-events-none"
            style={{
              background: gradientStyle,
              backgroundSize: "300% 300%",
            }}
            animate={{
              backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        )}

        {/* Dynamic Gradient Border Layer */}
        {!disabled && (
          <motion.div
            aria-hidden="true"
            className="absolute -inset-[1.5px] rounded-xl pointer-events-none"
            style={{
              background: gradientStyle,
              backgroundSize: "300% 300%",
            }}
            animate={{
              backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        )}

        {/* Main Inner Button */}
        <button
          ref={ref}
          disabled={disabled}
          className={cn(
            "relative z-10 inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-semibold text-white",
            "bg-slate-950/90 hover:bg-slate-900/90 backdrop-blur-md rounded-xl transition-all duration-300",
            "shadow-xl hover:shadow-2xl active:scale-95 disabled:opacity-50 disabled:pointer-events-none",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500",
            className
          )}
          {...props}
        >
          {children}
        </button>
      </div>
    );
  }
);

GlowButton.displayName = "GlowButton";

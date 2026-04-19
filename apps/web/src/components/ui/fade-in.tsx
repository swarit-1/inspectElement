"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { easeOutExpo } from "@/lib/motion";

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  y?: number;
  duration?: number;
  className?: string;
  as?: "div" | "section" | "article" | "header" | "footer" | "li";
  once?: boolean;
}

export function FadeIn({
  children,
  delay = 0,
  y = 16,
  duration = 0.56,
  className,
  as = "div",
  once = true,
}: FadeInProps) {
  const reduced = useReducedMotion();
  const Comp = motion[as];
  if (reduced) {
    return <Comp className={className}>{children}</Comp>;
  }
  return (
    <Comp
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-8% 0px -8% 0px" }}
      transition={{ duration, ease: easeOutExpo, delay }}
      className={className}
    >
      {children}
    </Comp>
  );
}

interface StaggerProps {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delayChildren?: number;
  as?: "div" | "section" | "ul" | "ol";
  once?: boolean;
}

export function Stagger({
  children,
  className,
  stagger = 0.08,
  delayChildren = 0,
  as = "div",
  once = true,
}: StaggerProps) {
  const reduced = useReducedMotion();
  const Comp = motion[as];
  if (reduced) {
    return <Comp className={className}>{children}</Comp>;
  }
  return (
    <Comp
      initial="hidden"
      whileInView="visible"
      viewport={{ once, margin: "-6% 0px -6% 0px" }}
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: stagger, delayChildren },
        },
      }}
      className={className}
    >
      {children}
    </Comp>
  );
}

export function StaggerItem({
  children,
  className,
  as = "div",
  y = 16,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li" | "article" | "section";
  y?: number;
}) {
  const Comp = motion[as];
  return (
    <Comp
      variants={{
        hidden: { opacity: 0, y },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.56, ease: easeOutExpo },
        },
      }}
      className={className}
    >
      {children}
    </Comp>
  );
}

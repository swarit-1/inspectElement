import type { Variants, Transition } from "framer-motion";

export const easeStage: Transition["ease"] = [0.22, 1, 0.36, 1];
export const easeOutExpo: Transition["ease"] = [0.16, 1, 0.3, 1];

export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.48, ease: easeOutExpo },
  },
};

export const fadeRiseContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
};

export const beatReveal: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: easeStage },
  },
  past: { opacity: 0.55, y: 0, transition: { duration: 0.3, ease: easeOutExpo } },
  future: { opacity: 0.25, y: 0 },
};

export const stagePacket: Variants = {
  idle: { scale: 1, opacity: 0.9 },
  active: {
    scale: 1.05,
    opacity: 1,
    transition: { duration: 0.42, ease: easeStage },
  },
  warn: {
    scale: 1.02,
    opacity: 1,
    transition: { duration: 0.42, ease: easeStage },
  },
  deny: {
    scale: 0.92,
    opacity: 1,
    transition: { duration: 0.42, ease: easeStage },
  },
};

export const drawerRise: Variants = {
  hidden: { opacity: 0, y: 64 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 220, damping: 28, mass: 0.9 },
  },
  exit: {
    opacity: 0,
    y: 64,
    transition: { duration: 0.28, ease: easeOutExpo },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.32, ease: easeStage },
  },
};

export const viewportOnce = { once: true, margin: "-10% 0px -10% 0px" };

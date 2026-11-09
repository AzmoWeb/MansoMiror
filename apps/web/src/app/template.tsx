"use client";

import { motion } from "motion/react";

/** Page transition: re-mounted on every navigation by the App Router. */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: [0, 0, 0, 1] }}>
      {children}
    </motion.div>
  );
}

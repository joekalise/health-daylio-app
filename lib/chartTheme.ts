"use client";
import { useEffect, useState } from "react";

export function useChartTheme() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return {
    grid: dark ? "#27272a" : "#e4e4e7",
    tick: { fill: dark ? "#71717a" : "#a1a1aa", fontSize: 11 as const },
    tooltip: {
      backgroundColor: dark ? "#18181b" : "#ffffff",
      border: `1px solid ${dark ? "#3f3f46" : "#e4e4e7"}`,
      borderRadius: 10,
    },
  };
}

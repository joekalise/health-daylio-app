"use client";

import { useRouter } from "next/navigation";
import MoodLogger from "./MoodLogger";

export default function MoodLoggerWrapper({ onSavedTab }: { onSavedTab?: () => void }) {
  const router = useRouter();
  return (
    <MoodLogger
      onSaved={() => {
        router.refresh();
        onSavedTab?.();
      }}
    />
  );
}

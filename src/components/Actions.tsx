"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const LABELS: Record<string, string> = {
  saved: "Save", applied: "Mark applied", dismissed: "Dismiss",
};

export function Actions({ jobId, compact = false }: { jobId: string; compact?: boolean }) {
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const send = (action: string) => {
    start(async () => {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobId, action }),
      });
      setDone(action);
      if (action === "dismissed") router.refresh();
    });
  };

  if (done && done !== "dismissed") {
    return <span className="text-[13px] text-[color:var(--ink2)]">{done}</span>;
  }

  return (
    <div className="flex gap-2">
      {Object.entries(LABELS).map(([action, label]) => (
        <button
          key={action}
          onClick={() => send(action)}
          disabled={pending}
          className={
            "rounded-[2px] border border-[color:var(--rule)] bg-white px-2.5 py-1 text-[12.5px] " +
            "hover:border-[color:var(--ink)] disabled:opacity-50 " +
            (action === "dismissed" ? "text-[color:var(--neg)]" : "")
          }
        >
          {compact && action === "applied" ? "Applied" : label}
        </button>
      ))}
    </div>
  );
}

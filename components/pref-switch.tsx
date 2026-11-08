"use client";

import { useSyncExternalStore } from "react";
import { readFlag, subscribePref, writeFlag } from "@/lib/prefs";

export function PrefSwitch({
  storageKey,
  label,
  detail,
  ariaLabel,
  onEnable,
}: {
  storageKey: string;
  label: string;
  detail: string;
  ariaLabel: string;
  onEnable?: () => void | Promise<void>;
}) {
  const on = useSyncExternalStore(
    (listener) => subscribePref(storageKey, listener),
    () => readFlag(storageKey),
    () => false,
  );

  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3.5">
      <span>
        <span className="block font-medium">{label}</span>
        <span className="mt-0.5 block text-sm text-muted">{detail}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={ariaLabel}
        onClick={() => {
          const next = !on;
          writeFlag(storageKey, next);
          if (next && onEnable) void onEnable();
        }}
        className={`relative h-7 w-12 shrink-0 rounded-full ${on ? "bg-violet" : "bg-[#e6e8ee]"}`}
      >
        <span className={`absolute top-0.5 size-6 rounded-full bg-white ${on ? "left-5" : "left-0.5"}`} />
      </button>
    </div>
  );
}

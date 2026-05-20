"use client";

import { useEffect } from "react";

import { clearOpenContext, rememberPreviousMemory } from "@/lib/recall-session";

export function MemoryVisitMarker({ itemId }: { itemId: string }) {
  useEffect(() => {
    rememberPreviousMemory(itemId);
    clearOpenContext();
  }, [itemId]);

  return null;
}

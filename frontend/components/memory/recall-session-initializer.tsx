"use client";

import { useEffect } from "react";

import { getClientRecallSessionId } from "@/lib/recall-session";

export function RecallSessionInitializer() {
  useEffect(() => {
    getClientRecallSessionId();
  }, []);

  return null;
}

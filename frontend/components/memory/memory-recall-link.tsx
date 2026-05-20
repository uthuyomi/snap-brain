"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";

import { getClientRecallSessionId, rememberRelatedOpen, rememberSearchOpen } from "@/lib/recall-session";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  children: ReactNode;
  source?: "search" | "related" | "normal";
  searchQuery?: string;
};

export function MemoryRecallLink({ children, source = "normal", searchQuery, onClick, ...props }: Props) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    getClientRecallSessionId();
    if (source === "search" && searchQuery) {
      rememberSearchOpen(searchQuery);
    }
    if (source === "related") {
      rememberRelatedOpen();
    }
    onClick?.(event);
  }

  return (
    <Link {...props} href={props.href as never} onClick={handleClick}>
      {children}
    </Link>
  );
}

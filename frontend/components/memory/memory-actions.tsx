"use client";

import { Archive, Pin, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { MouseEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { updateMemoryState } from "@/lib/api";

export function MemoryActions({
  itemId,
  isFavorite,
  isPinned,
  compact = false,
}: {
  itemId: string;
  isFavorite?: boolean;
  isPinned?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [favorite, setFavorite] = useState(Boolean(isFavorite));
  const [pinned, setPinned] = useState(Boolean(isPinned));
  const [busy, setBusy] = useState(false);

  async function run(event: MouseEvent, input: { is_favorite?: boolean; is_pinned?: boolean; archived?: boolean }) {
    event.preventDefault();
    event.stopPropagation();
    setBusy(true);
    try {
      await updateMemoryState(itemId, input);
      if (input.is_favorite !== undefined) setFavorite(input.is_favorite);
      if (input.is_pinned !== undefined) setPinned(input.is_pinned);
      toast.success("更新しました");
      router.refresh();
    } catch {
      toast.error("更新できませんでした");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant={favorite ? "soft" : "ghost"}
        size="icon"
        disabled={busy}
        aria-label="Favorite"
        className={compact ? "h-8 w-8" : undefined}
        onClick={(event) => run(event, { is_favorite: !favorite })}
      >
        <Star className={`h-4 w-4 ${favorite ? "fill-current" : ""}`} />
      </Button>
      <Button
        variant={pinned ? "soft" : "ghost"}
        size="icon"
        disabled={busy}
        aria-label="Pin"
        className={compact ? "h-8 w-8" : undefined}
        onClick={(event) => run(event, { is_pinned: !pinned })}
      >
        <Pin className={`h-4 w-4 ${pinned ? "fill-current" : ""}`} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        disabled={busy}
        aria-label="Archive"
        className={compact ? "h-8 w-8" : undefined}
        onClick={(event) => run(event, { archived: true })}
      >
        <Archive className="h-4 w-4" />
      </Button>
    </div>
  );
}

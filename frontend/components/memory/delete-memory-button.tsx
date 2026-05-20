"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { AppLocale } from "@/lib/i18n";
import { messages } from "@/lib/i18n";
import { archiveMemory } from "@/lib/api";

export function DeleteMemoryButton({ itemId, title, locale = "ja" }: { itemId: string; title: string; locale?: AppLocale }) {
  const t = messages[locale];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await archiveMemory(itemId);
      toast.success(t.deleteDone);
      setOpen(false);
      router.push("/");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.deleteFailed);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="quiet">
          <Trash2 className="h-4 w-4" />
          {t.delete}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-24px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-950">{t.deleteConfirmTitle}</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-6 text-slate-500">
                {title} - {t.deleteConfirmBody}
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-md p-2 text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="quiet" disabled={deleting}>
                {t.cancel}
              </Button>
            </Dialog.Close>
            <Button onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t.delete}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

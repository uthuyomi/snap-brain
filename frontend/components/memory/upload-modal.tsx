"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "framer-motion";
import { FileText, ImagePlus, LinkIcon, Loader2, MessageSquareText, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { uploadMemory } from "@/lib/api";
import type { AppLocale } from "@/lib/i18n";
import { messages } from "@/lib/i18n";

export function UploadModal({ locale = "ja" }: { locale?: AppLocale }) {
  const t = messages[locale];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [processing, setProcessing] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const steps = useMemo(
    () =>
      locale === "ja"
        ? [
            "アップロード中",
            "AIが画像の内容を整理しています",
            "テキストを読み取っています",
            "あとから探せるように記憶化しています",
            "検索用データを作成しています",
            "完了",
          ]
        : [
            "Uploading",
            "Organizing the image",
            "Extracting readable text",
            "Turning it into a searchable memory",
            "Preparing recall data",
            "Done",
          ],
    [locale],
  );

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const nextFile = acceptedFiles[0];
    if (!nextFile) return;
    setFile(nextFile);
    if (nextFile.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(nextFile));
    } else {
      setPreview(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".webp"],
      "application/pdf": [".pdf"],
    },
  });

  useEffect(() => {
    if (!open) return;
    function handlePaste(event: ClipboardEvent) {
      const pastedFile = Array.from(event.clipboardData?.files ?? []).find((item) => item.type.startsWith("image/"));
      if (!pastedFile) return;
      setFile(pastedFile);
      setPreview(URL.createObjectURL(pastedFile));
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [open]);

  useEffect(() => {
    if (!processing) {
      setStepIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setStepIndex((current) => Math.min(current + 1, steps.length - 2));
    }, 1200);
    return () => window.clearInterval(timer);
  }, [processing, steps.length]);

  async function submit() {
    if (!file && !note.trim()) {
      toast.message(t.uploadRequired);
      return;
    }
    setProcessing(true);
    setStepIndex(0);
    try {
      await uploadMemory(file, note.trim() || undefined);
      setStepIndex(steps.length - 1);
      toast.success(t.uploadSuccess);
      setOpen(false);
      setFile(null);
      setPreview(null);
      setNote("");
      router.refresh();
      window.setTimeout(() => router.refresh(), 3500);
      window.setTimeout(() => router.refresh(), 9000);
      window.setTimeout(() => router.refresh(), 18000);
    } catch {
      toast.error(t.uploadFailed);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button className="shadow-soft">
          <ImagePlus className="h-4 w-4" />
          {t.upload}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/20 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="my-auto max-h-[calc(100vh-32px)] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-soft outline-none sm:max-h-[calc(100vh-48px)] sm:p-5"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-base font-semibold text-slate-950">{t.organizeTitle}</Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-slate-500">{t.organizeBody}</Dialog.Description>
              </div>
              <Dialog.Close className="rounded-md p-2 text-slate-400 hover:bg-slate-100" aria-label={t.cancel}>
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>

            <div
              {...getRootProps()}
              className={`flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-4 text-center transition-colors sm:min-h-52 sm:p-5 ${
                isDragActive ? "border-blue-300 bg-blue-50" : "border-slate-300 bg-slate-50"
              }`}
            >
              <input {...getInputProps()} />
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="max-h-40 rounded-md border border-slate-200 object-contain sm:max-h-48" />
              ) : file ? (
                <div className="flex flex-col items-center gap-3">
                  <FileText className="h-10 w-10 text-slate-400" />
                  <p className="text-sm font-medium text-slate-700">{file.name}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-white text-blue-600 shadow-sm">
                    <ImagePlus className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{t.dropHere}</p>
                    <p className="mt-1 text-sm text-slate-500">{t.dropAccepts}</p>
                  </div>
                </div>
              )}
            </div>

            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t.quickNote}
              className="mt-4 min-h-20 w-full resize-none rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-blue-200 focus:ring-2 focus:ring-blue-100 sm:min-h-24"
            />

            {processing && (
              <div className="mt-4 rounded-lg bg-blue-50 px-3 py-3 text-sm text-blue-700">
                <div className="mb-3 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {steps[stepIndex]}
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {steps.map((step, index) => (
                    <div
                      key={step}
                      className={`h-1 rounded-full ${index <= stepIndex ? "bg-blue-500" : "bg-blue-100"}`}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniAction icon={ImagePlus} label={t.image} />
              <MiniAction icon={FileText} label="PDF" />
              <MiniAction icon={LinkIcon} label="URL" />
              <MiniAction icon={MessageSquareText} label={t.memo} />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button variant="quiet">{t.cancel}</Button>
              </Dialog.Close>
              <Button onClick={submit} disabled={processing}>
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t.save}
              </Button>
            </div>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function MiniAction({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex h-16 flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white text-xs text-slate-600">
      <Icon className="h-4 w-4 text-slate-400" />
      {label}
    </div>
  );
}

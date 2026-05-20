"use client";

import { PhotoProvider, PhotoView } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";

import type { SourceType } from "@/lib/types";
import { MemoryThumbnail } from "./memory-thumbnail";

type Props = {
  title: string;
  sourceType: SourceType;
  tone: "blue" | "slate" | "indigo" | "zinc";
  imageUrl?: string;
};

export function OriginalPreview({ title, sourceType, tone, imageUrl }: Props) {
  if (imageUrl && (sourceType === "screenshot" || sourceType === "photo")) {
    return (
      <PhotoProvider>
        <PhotoView src={imageUrl}>
          <div className="flex min-h-[420px] cursor-zoom-in items-center justify-center overflow-hidden rounded-md bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={title} className="max-h-[72vh] w-full object-contain" />
          </div>
        </PhotoView>
      </PhotoProvider>
    );
  }

  return (
    <PhotoProvider>
      <PhotoView src="/icon.svg">
        <div className="cursor-zoom-in">
          <MemoryThumbnail title={title} sourceType={sourceType} tone={tone} className="min-h-[420px] w-full" />
        </div>
      </PhotoView>
    </PhotoProvider>
  );
}

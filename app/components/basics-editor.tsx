"use client";

import { AtSign, ChevronLeft, ChevronRight, Eye, FileText, ImagePlus, User, Users, X } from "lucide-react";
import { useRef } from "react";

import { MarkdownEditor } from "@/app/components/markdown-editor";
import { useSheetApp } from "@/app/components/sheet-app";
import { Card, TextField } from "@/app/components/ui";
import { useT } from "@/lib/character-sheets/i18n";

export function BasicsEditor() {
  const { t } = useT();
  const { sheet, form, patchSheet, patchForm, addImage, imageUrls, removeImage } = useSheetApp();
  const scroller = useRef<HTMLDivElement>(null);
  if (!sheet || !form) return null;
  const images = Object.entries(sheet.info.images);

  function scroll(dir: number) {
    const node = scroller.current;
    if (!node) return;
    node.scrollBy({ left: dir * 220, behavior: "smooth" });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="w-full min-w-0">
        <h2 className="mb-3 text-lg font-black">{t("info.images")}</h2>
        <div className="relative w-full">
          <div ref={scroller} className="flex h-96 w-full flex-nowrap snap-x snap-mandatory gap-3 overflow-x-auto scrollbar-subtle">
            {images.map(([id, meta]) => (
              <Card key={id} className="relative h-full w-auto shrink-0 snap-start overflow-hidden aspect-[4/5]">
                {imageUrls[id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrls[id]} alt={meta.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full bg-content1" />
                )}
                <input
                  value={meta.title}
                  aria-label={meta.title || t("info.images")}
                  onChange={(event) =>
                    patchSheet((current) => ({
                      ...current,
                      info: {
                        ...current.info,
                        images: {
                          ...current.info.images,
                          [id]: { ...meta, title: event.target.value },
                        },
                      },
                    }))
                  }
                  className="absolute inset-x-0 bottom-0 w-full bg-content3/80 px-2 py-2 text-sm font-semibold outline-none"
                />
                <button
                  type="button"
                  aria-label={t("characterSheets.view.delete")}
                  className="absolute right-2 top-2 rounded-full bg-content3 p-2 shadow1"
                  onClick={() => void removeImage(id)}
                >
                  <X className="size-4" />
                </button>
              </Card>
            ))}
            {images.length ? (
              <Card
                as="label"
                tone="secondary"
                radius="md"
                padding="md"
                spotlight={false}
                className="aspect-[4/5] h-full shrink-0 cursor-pointer snap-start items-center justify-center !border-dashed text-sm font-semibold text-foreground/60 hover:bg-content3"
              >
                <ImagePlus className="size-8" />
                {t("info.addImage")}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void addImage(file);
                    event.target.value = "";
                  }}
                />
              </Card>
            ) : (
              <>
                <input
                  id="concept-image-file"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void addImage(file);
                    event.target.value = "";
                  }}
                />
                {["front", "side", "back", "extra"].map((slot) => (
                  <Card
                    as="label"
                    key={slot}
                    htmlFor="concept-image-file"
                    tone="secondary"
                    radius="md"
                    padding="md"
                    spotlight={false}
                    className="h-full min-w-48 flex-1 cursor-pointer items-center justify-center !border-dashed text-sm font-semibold text-foreground/60 hover:bg-content3"
                  >
                    <ImagePlus className="size-10" />
                    {slot === "front" ? t("info.emptyImages") : t("info.addImage")}
                  </Card>
                ))}
              </>
            )}
          </div>
          {images.length ? (
            <>
              <button
                type="button"
                aria-label={t("editor.prev")}
                className="absolute left-1 top-1/3 flex size-11 items-center justify-center rounded-full bg-content3 shadow1"
                onClick={() => scroll(-1)}
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label={t("editor.next")}
                className="absolute right-1 top-1/3 flex size-11 items-center justify-center rounded-full bg-content3 shadow1"
                onClick={() => scroll(1)}
              >
                <ChevronRight className="size-4" />
              </button>
            </>
          ) : null}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t("info.name")}
          icon={<User className="size-4" />}
          value={form.name}
          onChange={(value) => patchForm((next) => { next.name = value; })}
        />
        <TextField
          label={t("info.handle")}
          icon={<AtSign className="size-4" />}
          value={sheet.info.base.handle}
          onChange={(value) =>
            patchSheet((current) => ({
              ...current,
              info: { ...current.info, base: { ...current.info.base, handle: value } },
            }))
          }
        />
        <TextField
          label={t("info.sex")}
          icon={<Users className="size-4" />}
          value={sheet.info.base.sex}
          onChange={(value) =>
            patchSheet((current) => ({
              ...current,
              info: { ...current.info, base: { ...current.info.base, sex: value } },
            }))
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MarkdownEditor
          label={t("info.desc")}
          icon={<FileText className="size-4" />}
          value={sheet.info.base.desc}
          onChange={(value) =>
            patchSheet((current) => ({
              ...current,
              info: { ...current.info, base: { ...current.info.base, desc: value } },
            }))
          }
        />
        <MarkdownEditor
          label={t("info.appearance")}
          icon={<Eye className="size-4" />}
          value={sheet.info.base.appearance}
          onChange={(value) =>
            patchSheet((current) => ({
              ...current,
              info: { ...current.info, base: { ...current.info.base, appearance: value } },
            }))
          }
        />
      </div>
    </div>
  );
}

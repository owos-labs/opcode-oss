"use client";

import Image from "@tiptap/extension-image";
import { Markdown } from "@tiptap/markdown";
import Placeholder from "@tiptap/extension-placeholder";
import {
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
  type Editor,
  type NodeViewProps,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import { useSheetApp } from "@/app/components/sheet-app";
import { Card } from "@/app/components/card";
import { useT } from "@/lib/character-sheets/i18n";
import { imageFileFromDataTransfer, opfsImageSrc, parseOpfsImageSrc } from "@/lib/character-sheets/images";

function LocalImageView({ node }: NodeViewProps) {
  const { imageUrls } = useSheetApp();
  const id = parseOpfsImageSrc(node.attrs.src as string);
  const src = id ? imageUrls[id] : (node.attrs.src as string);
  return (
    <NodeViewWrapper as="div">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={(node.attrs.alt as string) || ""} className="max-h-64 w-auto max-w-full rounded-lg" />
      ) : null}
    </NodeViewWrapper>
  );
}

const LocalImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(LocalImageView);
  },
}).configure({ inline: false, allowBase64: false });

function Tool({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`flex size-11 items-center justify-center rounded-lg text-sm font-black ${
        active ? "bg-primary text-background" : "text-foreground/70 hover:bg-content2 hover:text-foreground"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function MarkdownEditor({
  label,
  value,
  onChange,
  placeholder,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: ReactNode;
}) {
  const { t } = useT();
  const { addImage } = useSheetApp();
  const addImageRef = useRef(addImage);
  addImageRef.current = addImage;
  const editorRef = useRef<Editor | null>(null);
  const insertRef = useRef<(file: File) => void>(() => undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit,
      LocalImage,
      Markdown,
      Placeholder.configure({ placeholder: placeholder || "" }),
    ],
    content: value,
    contentType: "markdown",
    onUpdate: ({ editor: current }) => onChangeRef.current(current.getMarkdown()),
    editorProps: {
      handlePaste(_, event) {
        const file = imageFileFromDataTransfer(event.clipboardData);
        if (!file) return false;
        event.preventDefault();
        insertRef.current(file);
        return true;
      },
      handleDrop(_, event) {
        const file = imageFileFromDataTransfer(event.dataTransfer);
        if (!file) return false;
        event.preventDefault();
        insertRef.current(file);
        return true;
      },
    },
  });
  editorRef.current = editor;
  insertRef.current = (file) => {
    void addImageRef.current(file).then((id) => {
      if (id) editorRef.current?.chain().focus().setImage({ src: opfsImageSrc(id), alt: file.name }).run();
    });
  };

  useEffect(() => {
    if (!editor || editor.isFocused) return;
    if (editor.getMarkdown().trim() === (value || "").trim()) return;
    editor.commands.setContent(value || "", { contentType: "markdown" });
  }, [editor, value]);

  return (
    <div className="oc-md flex min-w-0 flex-col gap-2">
      <span className="flex items-center gap-2 text-sm font-semibold text-foreground/70">
        {icon ? <span className="text-foreground/50">{icon}</span> : null}
        {label}
      </span>
      <Card radius="md" padding="none" className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border1 p-1" role="toolbar" aria-label={label}>
          <Tool label={t("editor.bold")} active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}>
            <Bold className="size-4" />
          </Tool>
          <Tool label={t("editor.italic")} active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}>
            <Italic className="size-4" />
          </Tool>
          <Tool label={t("editor.h1")} active={editor?.isActive("heading", { level: 1 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
            <Heading1 className="size-4" />
          </Tool>
          <Tool label={t("editor.h2")} active={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 className="size-4" />
          </Tool>
          <Tool label={t("editor.h3")} active={editor?.isActive("heading", { level: 3 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
            <Heading3 className="size-4" />
          </Tool>
          <Tool label={t("editor.bullet")} active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
            <List className="size-4" />
          </Tool>
          <Tool label={t("editor.ordered")} active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
            <ListOrdered className="size-4" />
          </Tool>
          <Tool label={t("editor.code")} active={editor?.isActive("code")} onClick={() => editor?.chain().focus().toggleCode().run()}>
            <Code className="size-4" />
          </Tool>
          <Tool label={t("editor.quote")} active={editor?.isActive("blockquote")} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
            <Quote className="size-4" />
          </Tool>
          <Tool label={t("editor.hr")} onClick={() => editor?.chain().focus().setHorizontalRule().run()}>
            <Minus className="size-4" />
          </Tool>
          <Tool label={t("editor.image")} onClick={() => fileRef.current?.click()}>
            <ImagePlus className="size-4" />
          </Tool>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) insertRef.current(file);
              event.target.value = "";
            }}
          />
        </div>
        <EditorContent editor={editor} className="px-4 py-3" />
      </Card>
    </div>
  );
}

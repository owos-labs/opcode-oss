"use client";

import { Button, Switch } from "@heroui/react";
import { Dropdown } from "@heroui/react/dropdown";
import { Modal } from "@heroui/react/modal";
import { ArrowLeft, ChevronDown, Copy, FileJson, FileText, Pencil, RotateCcw, Save, Swords, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { useSheetApp } from "@/app/components/sheet-app";
import { ModalShortcutFooter, Notice, download } from "@/app/components/ui";
import { formatComplianceErrorLine, listCareerComplianceErrors } from "@/lib/character-sheets/compliance-errors";
import { useT } from "@/lib/character-sheets/i18n";
import { sheetListLabel } from "@/lib/character-sheets/model";

export default function SheetWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useT();
  const {
    ready,
    sheet,
    form,
    drafts,
    loadError,
    retryLoad,
    autosave,
    setAutosave,
    saveState,
    saveNow,
    setMode,
    duplicate,
    exportJson,
    exportMarkdown,
    remove,
  } = useSheetApp();
  const [modeErrors, setModeErrors] = useState<Array<{ id: string; text: string }>>([]);
  const [pendingMode, setPendingMode] = useState<"create" | "career" | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  if (!ready) {
    return (
      <p className="p-4 text-sm text-foreground/60">{t("characterSheets.list.loading")}</p>
    );
  }
  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Notice
          title={t("characterSheets.list.failedTitle")}
          description={t("characterSheets.list.errorDescription")}
          action={
            <Button variant="outline" onPress={() => void retryLoad()}>
              {t("characterSheets.list.retry")}
            </Button>
          }
        />
      </div>
    );
  }
  if (!sheet) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-2xl font-black">{t("characterSheets.view.notFoundTitle")}</h1>
        <p className="text-sm text-foreground/60">{t("characterSheets.view.notFoundDescription")}</p>
        <Link href="/character-sheet" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border1 px-4 py-2 font-semibold shadow1 hover:bg-content2">
          <ArrowLeft className="size-4" />
          {t("sheet.back")}
        </Link>
      </div>
    );
  }
  const section = pathname.includes("/inventory")
    ? "sheet.inventory"
    : pathname.includes("/attributes")
      ? "sheet.attributes"
      : "sheet.basics";
  const status =
    saveState === "saving"
      ? t("sheet.saving")
      : saveState === "error"
        ? t("sheet.saveFailed")
        : saveState === "unsaved"
          ? t("characterSheets.unsaved.status")
          : t("sheet.saved");
  const file = sheet.name || "sheet";
  const complianceLines = (errors: Record<string, string>) => {
    if (!form) return Object.entries(errors).map(([id, messageKey]) => ({ id, text: t(messageKey) }));
    const byId = new Map(listCareerComplianceErrors(form, drafts).map((line) => [line.id, line]));
    return Object.keys(errors).map((id) => {
      const line = byId.get(id);
      return { id, text: line ? formatComplianceErrorLine(line, t) : t(errors[id]!) };
    });
  };
  const applyMode = (mode: "create" | "career") => {
    const result = setMode(mode);
    if (result.ok) {
      setModeErrors([]);
      setPendingMode(null);
      return;
    }
    setModeErrors(complianceLines(result.errors));
  };
  const requestMode = (mode: "create" | "career") => {
    if (sheet.mode === mode) return;
    setModeErrors([]);
    setPendingMode(mode);
  };
  const showErrorsInModal = pendingMode !== null && modeErrors.length > 0;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-x-4 gap-y-3 px-1">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-black">{t(section)}</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <p className="truncate text-foreground/60">{sheetListLabel(sheet)}</p>
            <span className="text-foreground/30" aria-hidden>
              ·
            </span>
            <span className="text-xs font-semibold text-foreground/50" aria-live="polite">
              {status}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border1 bg-content2 px-2 py-1">
            <Switch isSelected={autosave} onChange={setAutosave} aria-label={t("sheet.autosave")}>
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <span className="text-xs font-semibold">{t("sheet.autosave")}</span>
              </Switch.Content>
            </Switch>
            {!autosave ? (
              <Button size="sm" variant="secondary" className="gap-2" onPress={() => void saveNow()}>
                <Save className="size-4" />
                {t("sheet.saveNow")}
              </Button>
            ) : null}
            {saveState === "error" ? (
              <Button size="sm" variant="outline" className="gap-2" onPress={() => void saveNow()}>
                <RotateCcw className="size-4" />
                {t("characterSheets.list.retry")}
              </Button>
            ) : null}
          </div>
          <div className="flex items-center rounded-lg bg-content2 p-0.5" role="group">
            <Button
              size="sm"
              variant={sheet.mode === "create" ? "primary" : "ghost"}
              className="gap-2"
              aria-pressed={sheet.mode === "create"}
              onPress={() => requestMode("create")}
            >
              <Pencil className="size-4" />
              {t("mode.create")}
            </Button>
            <Button
              size="sm"
              variant={sheet.mode === "career" ? "primary" : "ghost"}
              className="gap-2"
              aria-pressed={sheet.mode === "career"}
              onPress={() => requestMode("career")}
            >
              <Swords className="size-4" />
              {t("mode.career")}
            </Button>
          </div>
          <Button size="sm" variant="outline" className="gap-2" onPress={async () => {
            const copy = await duplicate();
            if (copy) router.push(`/character-sheet/${copy.id}/basics`);
          }}>
            <Copy className="size-4" />
            {t("sheet.duplicate")}
          </Button>
          <Dropdown>
            <Button size="sm" variant="outline" className="gap-2">
              {t("sheet.export")}
              <ChevronDown className="size-4" />
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu
                onAction={(key) => {
                  if (key === "json") download(`${file}.json`, exportJson(), "application/json");
                  if (key === "md") download(`${file}.md`, exportMarkdown(), "text/markdown");
                }}
              >
                <Dropdown.Item id="json" textValue={t("sheet.exportJson")}>
                  <span className="flex items-center gap-2">
                    <FileJson className="size-4" />
                    {t("sheet.exportJson")}
                  </span>
                </Dropdown.Item>
                <Dropdown.Item id="md" textValue={t("sheet.exportMd")}>
                  <span className="flex items-center gap-2">
                    <FileText className="size-4" />
                    {t("sheet.exportMd")}
                  </span>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
          <span className="hidden h-5 w-px bg-border1 sm:block" aria-hidden />
          <Button size="sm" variant="danger" className="gap-2" onPress={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" />
            {t("sheet.delete")}
          </Button>
        </div>
      </div>
      {modeErrors.length && !showErrorsInModal ? (
        <div className="rounded-lg border border-error bg-content2 p-3 text-sm text-error">
          <p className="font-semibold">{t("mode.blocked")}</p>
          <ul className="mt-2 space-y-1 pl-4">
            {modeErrors.map((error) => (
              <li key={error.id} className="list-disc marker:text-error/70">
                {error.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Modal
        isOpen={pendingMode !== null}
        onOpenChange={(open) => {
          if (!open) setPendingMode(null);
        }}
      >
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog aria-label={t("mode.confirmSwitchTitle")} className="flex flex-col gap-4">
              <h2 className="text-lg font-black">{t("mode.confirmSwitchTitle")}</h2>
              <p className="text-sm leading-6 text-foreground/80">
                {pendingMode === "career" ? t("mode.confirmCareerBody") : t("mode.confirmEditBody")}
              </p>
              {showErrorsInModal ? (
                <div className="rounded-lg border border-error/60 bg-error/5 p-3 text-sm text-error">
                  <p className="font-semibold">{t("mode.blocked")}</p>
                  <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto pl-4">
                    {modeErrors.map((error) => (
                      <li key={error.id} className="list-disc marker:text-error/70">
                        {error.text}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <ModalShortcutFooter
                cancelLabel={t("mode.cancelSwitch")}
                onCancel={() => setPendingMode(null)}
                confirmLabel={t("mode.confirmSwitchAction")}
                confirmVariant="primary"
                onConfirm={() => {
                  if (pendingMode) applyMode(pendingMode);
                }}
              />
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
      <Modal isOpen={deleteOpen} onOpenChange={setDeleteOpen}>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog aria-label={t("shared.phrases.deleteConfirm")} className="flex flex-col gap-4">
              <h2 className="text-lg font-black">{t("shared.phrases.deleteConfirm")}</h2>
              <p className="text-sm leading-6 text-foreground/80">{t("sheet.deleteConfirmBody")}</p>
              <ModalShortcutFooter
                cancelLabel={t("common.close")}
                onCancel={() => setDeleteOpen(false)}
                confirmLabel={t("sheet.delete")}
                confirmVariant="danger"
                onConfirm={() => {
                  setDeleteOpen(false);
                  void remove().then(() => router.push("/character-sheet"));
                }}
              />
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 scrollbar-subtle">{children}</div>
    </div>
  );
}

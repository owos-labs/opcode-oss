"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  applyEditorState,
  careerCompliance,
  createLocalSheet,
  duplicateSheet,
  parseImportedSheet,
  readContainers,
  sheetToOpcodeForm,
  toMarkdown,
  writeContainers,
  type ItemContainer,
  type OpcodeLocalSheet,
  type SheetMode,
} from "@/lib/character-sheets/model";
import { readOpcodeInventory } from "@/lib/character-sheets/opcodeInventory";
import type { OpcodeInventoryDraft } from "@/lib/character-sheets/opcodeInventory.types";
import type { OpcodeSheetForm } from "@/lib/character-sheets/characterSheet.types";
import { syncCombatBenchSheetCacheFromOpfs, upsertCombatBenchSheetCache } from "@/lib/character-sheets/sheet-catalog";
import {
  deleteImage,
  deleteSheet as removeStoredSheet,
  listSheets,
  readImage,
  readSheet,
  writeImage,
  writeSheet,
} from "@/lib/character-sheets/storage";
import {
  reconcileSaveStateAfterAutosaveOff,
  type SheetSaveState,
} from "@/lib/character-sheets/sheetSaveState";

type SaveState = SheetSaveState;

type SheetContextValue = {
  ready: boolean;
  loadError: boolean;
  importError: boolean;
  sheets: OpcodeLocalSheet[];
  refreshList: () => Promise<void>;
  retryLoad: () => Promise<void>;
  createSheet: () => Promise<OpcodeLocalSheet>;
  importText: (text: string) => Promise<OpcodeLocalSheet | null>;
  clearImportError: () => void;
  sheet: OpcodeLocalSheet | null;
  form: OpcodeSheetForm | null;
  drafts: OpcodeInventoryDraft[];
  containers: Record<string, ItemContainer>;
  autosave: boolean;
  saveState: SaveState;
  setAutosave: (value: boolean) => void;
  saveNow: () => Promise<void>;
  patchSheet: (patch: Partial<OpcodeLocalSheet> | ((sheet: OpcodeLocalSheet) => OpcodeLocalSheet)) => void;
  patchForm: (patch: (form: OpcodeSheetForm) => void) => void;
  setDrafts: (drafts: OpcodeInventoryDraft[]) => void;
  setContainers: (containers: Record<string, ItemContainer>) => void;
  setMode: (mode: SheetMode) => { ok: boolean; errors: Record<string, string> };
  duplicate: () => Promise<OpcodeLocalSheet | null>;
  remove: () => Promise<void>;
  exportJson: () => string;
  exportMarkdown: () => string;
  addImage: (file: File) => Promise<string | undefined>;
  imageUrls: Record<string, string>;
  removeImage: (id: string) => Promise<void>;
  listQuery: string;
  setListQuery: (value: string) => void;
  listMode: "all" | SheetMode;
  setListMode: (value: "all" | SheetMode) => void;
  updateSheetGroup: (id: string, group: string) => Promise<void>;
  duplicateSheetById: (id: string) => Promise<OpcodeLocalSheet | null>;
  removeSheetById: (id: string) => Promise<void>;
  groups: string[];
  createGroup: (name: string) => void;
};

const SheetContext = createContext<SheetContextValue | null>(null);

function cloneForm(form: OpcodeSheetForm): OpcodeSheetForm {
  return JSON.parse(JSON.stringify(form)) as OpcodeSheetForm;
}

export function SheetAppProvider({
  sheetId,
  children,
}: {
  sheetId?: string;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [importError, setImportError] = useState(false);
  const [sheets, setSheets] = useState<OpcodeLocalSheet[]>([]);
  const [sheet, setSheet] = useState<OpcodeLocalSheet | null>(null);
  const [form, setForm] = useState<OpcodeSheetForm | null>(null);
  const [drafts, setDraftsState] = useState<OpcodeInventoryDraft[]>([]);
  const [autosave, setAutosave] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [listQuery, setListQuery] = useState("");
  const [listMode, setListMode] = useState<"all" | SheetMode>("all");
  const [groups, setGroups] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const value = JSON.parse(window.localStorage.getItem("opcode.groups") || "[]");
      return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim())) : [];
    } catch {
      return [];
    }
  });
  const dirty = useRef(false);
  const editorRef = useRef({ sheet, form, drafts });
  useEffect(() => {
    editorRef.current = { sheet, form, drafts };
  }, [drafts, form, sheet]);

  const refreshList = useCallback(async () => {
    const next = await listSheets();
    setSheets(next);
    syncCombatBenchSheetCacheFromOpfs(next);
  }, []);

  const hydrate = useCallback(async (id: string) => {
    const next = await readSheet(id);
    if (!next) {
      dirty.current = false;
      setSaveState("saved");
      setSheet(null);
      setForm(null);
      setDraftsState([]);
      return;
    }
    dirty.current = false;
    setSaveState("saved");
    setSheet(next);
    setForm(sheetToOpcodeForm(next));
    setDraftsState(readOpcodeInventory(next.status));
    const urls: Record<string, string> = {};
    await Promise.all(
      Object.keys(next.info.images).map(async (imageId) => {
        const blob = await readImage(next.id, imageId);
        if (blob) urls[imageId] = URL.createObjectURL(blob);
      }),
    );
    setImageUrls((prev) => {
      Object.values(prev).forEach(URL.revokeObjectURL);
      return urls;
    });
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await refreshList();
        if (sheetId) await hydrate(sheetId);
        else {
          setSheet(null);
          setForm(null);
          setDraftsState([]);
          setImageUrls((prev) => {
            Object.values(prev).forEach(URL.revokeObjectURL);
            return {};
          });
        }
        if (alive) setLoadError(false);
      } catch {
        if (alive) setLoadError(true);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [hydrate, refreshList, sheetId]);

  const persist = useCallback(async (next: OpcodeLocalSheet) => {
    setSaveState("saving");
    try {
      await writeSheet(next);
      dirty.current = false;
      setSaveState("saved");
      await refreshList();
    } catch {
      dirty.current = true;
      setSaveState("error");
    }
  }, [refreshList]);

  const saveNow = useCallback(async () => {
    const { sheet: currentSheet, form: currentForm, drafts: currentDrafts } = editorRef.current;
    if (!currentSheet || !currentForm) return;
    setSaveState("saving");
    const next = applyEditorState(currentSheet, currentForm, currentDrafts);
    setSheet(next);
    await persist(next);
  }, [persist]);

  useEffect(() => {
    if (!autosave || !dirty.current || !sheet || !form) return;
    const timer = window.setTimeout(() => {
      if (!dirty.current) return;
      const { sheet: currentSheet, form: currentForm, drafts: currentDrafts } = editorRef.current;
      if (!currentSheet || !currentForm) return;
      const next = applyEditorState(currentSheet, currentForm, currentDrafts);
      dirty.current = false;
      setSheet(next);
      void persist(next);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [autosave, drafts, form, persist, sheet]);

  const setAutosaveEnabled = useCallback((value: boolean) => {
    setAutosave(value);
    if (!value) {
      setSaveState((current) => reconcileSaveStateAfterAutosaveOff(dirty.current, current));
    }
  }, []);

  const mark = () => {
    dirty.current = true;
    setSaveState(autosave ? "saving" : "unsaved");
  };

  const patchSheet: SheetContextValue["patchSheet"] = (patch) => {
    setSheet((current) => {
      if (!current) return current;
      mark();
      return typeof patch === "function" ? patch(current) : { ...current, ...patch, updated_at: new Date().toISOString() };
    });
  };

  const patchForm: SheetContextValue["patchForm"] = (updater) => {
    setForm((current) => {
      if (!current) return current;
      mark();
      const next = cloneForm(current);
      updater(next);
      return next;
    });
  };

  const setDrafts = (next: OpcodeInventoryDraft[]) => {
    mark();
    setDraftsState(next);
  };

  const containers = sheet ? readContainers(sheet.status) : {};
  const setContainers = (next: Record<string, ItemContainer>) => {
    patchSheet((current) => ({
      ...current,
      status: writeContainers(current.status, next),
    }));
  };

  const setMode: SheetContextValue["setMode"] = (mode) => {
    if (!form) return { ok: false, errors: {} };
    if (mode === "career") {
      const errors = careerCompliance(form, drafts);
      if (Object.keys(errors).length) return { ok: false, errors };
    }
    patchSheet({ mode });
    return { ok: true, errors: {} };
  };

  const retryLoad = useCallback(async () => {
    setReady(false);
    setLoadError(false);
    try {
      await refreshList();
      if (sheetId) await hydrate(sheetId);
    } catch {
      setLoadError(true);
    } finally {
      setReady(true);
    }
  }, [hydrate, refreshList, sheetId]);

  const createSheet = async () => {
    const next = createLocalSheet();
    await writeSheet(next);
    upsertCombatBenchSheetCache(next);
    await refreshList();
    return next;
  };

  const importText = async (text: string) => {
    const next = parseImportedSheet(text);
    if (!next) {
      setImportError(true);
      return null;
    }
    setImportError(false);
    next.id = crypto.randomUUID();
    next.created_at = new Date().toISOString();
    next.updated_at = next.created_at;
    await writeSheet(next);
    upsertCombatBenchSheetCache(next);
    await refreshList();
    return next;
  };

  const updateSheetGroup = async (id: string, group: string) => {
    const current = sheets.find((entry) => entry.id === id);
    if (!current) return;
    const next = { ...current, group: group.trim(), updated_at: new Date().toISOString() };
    setSheets((entries) => entries.map((entry) => (entry.id === id ? next : entry)));
    try {
      await writeSheet(next);
    } catch {
      await refreshList();
    }
  };

  const createGroup = (name: string) => {
    const value = name.trim();
    if (!value) return;
    setGroups((current) => {
      const next = current.includes(value) ? current : [...current, value];
      window.localStorage.setItem("opcode.groups", JSON.stringify(next));
      return next;
    });
  };

  const duplicateSheetById = async (id: string) => {
    const current = sheets.find((entry) => entry.id === id);
    if (!current) return null;
    const copy = duplicateSheet(current);
    await writeSheet(copy);
    await refreshList();
    return copy;
  };

  const removeSheetById = async (id: string) => {
    await removeStoredSheet(id);
    setSheets((entries) => entries.filter((entry) => entry.id !== id));
  };

  const duplicate = async () => {
    if (!sheet) return null;
    const copy = duplicateSheet(sheet);
    await writeSheet(copy);
    await refreshList();
    return copy;
  };

  const remove = async () => {
    if (!sheet) return;
    await removeStoredSheet(sheet.id);
    setSheet(null);
    await refreshList();
  };

  const addImage = async (file: File) => {
    if (!sheet) return;
    const id = crypto.randomUUID();
    await writeImage(sheet.id, id, file);
    patchSheet((current) => ({
      ...current,
      info: {
        ...current.info,
        images: { ...current.info.images, [id]: { title: file.name, desc: "" } },
      },
    }));
    setImageUrls((prev) => ({ ...prev, [id]: URL.createObjectURL(file) }));
    return id;
  };

  const removeImageFile = async (id: string) => {
    if (!sheet) return;
    await deleteImage(sheet.id, id);
    patchSheet((current) => {
      const images = { ...current.info.images };
      delete images[id];
      return { ...current, info: { ...current.info, images } };
    });
    setImageUrls((prev) => {
      const next = { ...prev };
      if (next[id]) URL.revokeObjectURL(next[id]);
      delete next[id];
      return next;
    });
  };

  const value = useMemo<SheetContextValue>(
    () => ({
      ready,
      loadError,
      importError,
      sheets,
      refreshList,
      retryLoad,
      createSheet,
      importText,
      clearImportError: () => setImportError(false),
      sheet,
      form,
      drafts,
      containers,
      autosave,
      saveState,
      setAutosave: setAutosaveEnabled,
      saveNow,
      patchSheet,
      patchForm,
      setDrafts,
      setContainers,
      setMode,
      duplicate,
      remove,
      exportJson: () => {
        const { sheet: currentSheet, form: currentForm, drafts: currentDrafts } = editorRef.current;
        if (!currentSheet || !currentForm) return "{}";
        return JSON.stringify(applyEditorState(currentSheet, currentForm, currentDrafts), null, 2);
      },
      exportMarkdown: () => {
        const { sheet: currentSheet, form: currentForm, drafts: currentDrafts } = editorRef.current;
        if (!currentSheet || !currentForm) return "";
        const snapshot = applyEditorState(currentSheet, currentForm, currentDrafts);
        return toMarkdown(snapshot, currentForm, currentDrafts);
      },
      addImage,
      imageUrls,
      removeImage: removeImageFile,
      listQuery,
      setListQuery,
      listMode,
      setListMode,
      updateSheetGroup,
      duplicateSheetById,
      removeSheetById,
      groups,
      createGroup,
    }),
    [autosave, containers, createGroup, drafts, duplicateSheetById, form, groups, imageUrls, importError, listMode, listQuery, loadError, ready, removeSheetById, retryLoad, saveNow, saveState, sheet, sheets, updateSheetGroup],
  );

  return <SheetContext.Provider value={value}>{children}</SheetContext.Provider>;
}

export function useSheetApp() {
  const ctx = useContext(SheetContext);
  if (!ctx) throw new Error("SheetAppProvider missing");
  return ctx;
}

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
  createCombatMapDocument,
  type CombatMapDocument,
} from "@/lib/combat/combat-map-document";
import {
  deleteCombatMapLayer,
  renameCombatMapLayer,
  setCombatMapLayerGroups,
} from "@/lib/combat/combat-editor-map";
import {
  importCombatMapFromText,
  type CombatMapImportResult,
} from "@/lib/combat/combat-map-import-export";
import {
  combatMapsOpfsAvailable,
  deleteCombatMap,
  listCombatMaps,
  readCombatMap,
  writeCombatMap,
} from "@/lib/combat/combat-map-storage";

type CombatEditorLayout = "edit" | "play";

type CombatListValue = {
  ready: boolean;
  loadError: boolean;
  maps: CombatMapDocument[];
  listQuery: string;
  setListQuery: (value: string) => void;
  refreshList: () => Promise<void>;
  createMap: () => Promise<CombatMapDocument>;
  saveMap: (map: CombatMapDocument) => Promise<void>;
  removeMap: (id: string) => Promise<void>;
  loadMap: (id: string) => Promise<CombatMapDocument | null>;
  importMapFromText: (text: string) => Promise<CombatMapImportResult>;
};

type CombatEditorMetaValue = {
  mapId?: string;
  mapMissing: boolean;
  mapLoading: boolean;
  layout: CombatEditorLayout;
  setLayout: (layout: CombatEditorLayout) => void;
};

type CombatEditorMapValue = {
  map: CombatMapDocument | null;
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  setMap: (map: CombatMapDocument) => void;
  saveEditorMap: () => Promise<void>;
  deleteLayer: (id: string) => void;
  renameLayer: (id: string, name: string) => void;
  setLayerGroups: (groups: NonNullable<CombatMapDocument["layerGroups"]>) => void;
};

const CombatListContext = createContext<CombatListValue | null>(null);
const CombatEditorMetaContext = createContext<CombatEditorMetaValue | null>(null);
const CombatEditorMapContext = createContext<CombatEditorMapValue | null>(null);

export function CombatAppProvider({
  mapId,
  children,
}: {
  mapId?: string;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [maps, setMaps] = useState<CombatMapDocument[]>([]);
  const [listQuery, setListQuery] = useState("");
  const [map, setMapState] = useState<CombatMapDocument | null>(null);
  const [mapMissing, setMapMissing] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [layout, setLayout] = useState<CombatEditorLayout>("edit");
  const mapRef = useRef<CombatMapDocument | null>(null);
  mapRef.current = map;

  const refreshList = useCallback(async () => {
    if (!(await combatMapsOpfsAvailable())) {
      setMaps([]);
      setLoadError(true);
      setReady(true);
      return;
    }
    try {
      setMaps(await listCombatMaps());
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setReady(true);
    }
  }, []);

  const needsList = !mapId || layout === "play";

  useEffect(() => {
    if (!needsList) return;
    void refreshList();
  }, [needsList, refreshList]);

  useEffect(() => {
    if (!mapId) {
      setMapState(null);
      setMapMissing(false);
      setMapLoading(false);
      setSelectedIds([]);
      setLayout("edit");
      return;
    }

    let cancelled = false;
    setMapLoading(true);
    setMapMissing(false);
    setSelectedIds([]);
    setLayout("edit");

    void readCombatMap(mapId).then((loaded) => {
      if (cancelled) return;
      setMapLoading(false);
      if (!loaded) {
        setMapMissing(true);
        setMapState(null);
        return;
      }
      setMapState(loaded);
    });

    return () => {
      cancelled = true;
    };
  }, [mapId]);

  const createMap = useCallback(async () => {
    const next = createCombatMapDocument();
    await writeCombatMap(next);
    await refreshList();
    return next;
  }, [refreshList]);

  const saveMap = useCallback(
    async (nextMap: CombatMapDocument) => {
      const next = { ...nextMap, updated_at: new Date().toISOString() };
      await writeCombatMap(next);
      setMaps((prev) => {
        const rest = prev.filter((entry) => entry.id !== next.id);
        return [next, ...rest].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      });
      if (mapId === next.id) setMapState(next);
    },
    [mapId],
  );

  const removeMap = useCallback(
    async (id: string) => {
      await deleteCombatMap(id);
      await refreshList();
    },
    [refreshList],
  );

  const loadMap = useCallback(async (id: string) => readCombatMap(id), []);

  const importMapFromText = useCallback(async (text: string): Promise<CombatMapImportResult> => {
    const result = importCombatMapFromText(text);
    if (!result.ok) return result;
    await writeCombatMap(result.map);
    setMaps((prev) =>
      [result.map, ...prev.filter((entry) => entry.id !== result.map.id)].sort((a, b) =>
        b.updated_at.localeCompare(a.updated_at),
      ),
    );
    return result;
  }, []);

  const setMap = useCallback((next: CombatMapDocument) => {
    setMapState(next);
  }, []);

  const saveEditorMap = useCallback(async () => {
    const current = mapRef.current;
    if (!current) return;
    await saveMap(current);
  }, [saveMap]);

  const deleteLayer = useCallback((id: string) => {
    setMapState((current) => {
      if (!current) return current;
      return deleteCombatMapLayer(current, id) ?? current;
    });
    setSelectedIds((current) => current.filter((entry) => entry !== id));
  }, []);

  const renameLayer = useCallback((id: string, name: string) => {
    const current = mapRef.current;
    if (!current) return;
    const { map: nextMap, id: nextId } = renameCombatMapLayer(current, id, name);
    setMapState(nextMap);
    if (nextId !== id) setSelectedIds((ids) => ids.map((entry) => (entry === id ? nextId : entry)));
  }, []);

  const setLayerGroups = useCallback((layerGroups: NonNullable<CombatMapDocument["layerGroups"]>) => {
    setMapState((current) => (current ? setCombatMapLayerGroups(current, layerGroups) : current));
  }, []);

  const listValue = useMemo(
    () => ({
      ready,
      loadError,
      maps,
      listQuery,
      setListQuery,
      refreshList,
      createMap,
      saveMap,
      removeMap,
      loadMap,
      importMapFromText,
    }),
    [
      ready,
      loadError,
      maps,
      listQuery,
      refreshList,
      createMap,
      saveMap,
      removeMap,
      loadMap,
      importMapFromText,
    ],
  );

  const metaValue = useMemo(
    () => ({
      mapId,
      mapMissing,
      mapLoading,
      layout,
      setLayout,
    }),
    [mapId, mapMissing, mapLoading, layout],
  );

  const mapValue = useMemo(
    () => ({
      map,
      selectedIds,
      setSelectedIds,
      setMap,
      saveEditorMap,
      deleteLayer,
      renameLayer,
      setLayerGroups,
    }),
    [map, selectedIds, setMap, saveEditorMap, deleteLayer, renameLayer, setLayerGroups],
  );

  return (
    <CombatListContext.Provider value={listValue}>
      <CombatEditorMetaContext.Provider value={metaValue}>
        <CombatEditorMapContext.Provider value={mapValue}>{children}</CombatEditorMapContext.Provider>
      </CombatEditorMetaContext.Provider>
    </CombatListContext.Provider>
  );
}

export function useCombatList() {
  const ctx = useContext(CombatListContext);
  if (!ctx) throw new Error("useCombatList must be used within CombatAppProvider");
  return ctx;
}

export function useCombatEditorMeta() {
  const ctx = useContext(CombatEditorMetaContext);
  if (!ctx) throw new Error("useCombatEditorMeta must be used within CombatAppProvider");
  return ctx;
}

export function useCombatEditorMap() {
  const ctx = useContext(CombatEditorMapContext);
  if (!ctx) throw new Error("useCombatEditorMap must be used within CombatAppProvider");
  return ctx;
}

/** @deprecated Prefer useCombatList / useCombatEditorMeta / useCombatEditorMap. */
export function useCombatApp() {
  return { ...useCombatList(), ...useCombatEditorMeta(), ...useCombatEditorMap() };
}

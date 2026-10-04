import { normalizeCombatMapDocument, type CombatMapDocument } from "./combat-map-document.ts";

const ROOT = "opcode";
const MAPS = "combat-maps";

async function rootDir() {
  const opfs = await navigator.storage.getDirectory();
  return opfs.getDirectoryHandle(ROOT, { create: true });
}

async function mapsDir() {
  const root = await rootDir();
  return root.getDirectoryHandle(MAPS, { create: true });
}

export async function combatMapsOpfsAvailable(): Promise<boolean> {
  return typeof navigator !== "undefined" && typeof navigator.storage?.getDirectory === "function";
}

async function readMapFileHandle(handle: FileSystemFileHandle): Promise<CombatMapDocument | null> {
  try {
    const file = await handle.getFile();
    return normalizeCombatMapDocument(JSON.parse(await file.text()));
  } catch {
    return null;
  }
}

export async function listCombatMaps(): Promise<CombatMapDocument[]> {
  if (!(await combatMapsOpfsAvailable())) return [];
  const dir = await mapsDir();
  const maps: CombatMapDocument[] = [];
  const dirWithEntries = dir as FileSystemDirectoryHandle & {
    entries?: () => AsyncIterable<[string, FileSystemHandle]>;
    values?: () => AsyncIterable<FileSystemHandle>;
  };

  if (dirWithEntries.entries) {
    for await (const [name, handle] of dirWithEntries.entries()) {
      if (handle.kind !== "file" || !name.endsWith(".json")) continue;
      const map = await readMapFileHandle(handle as FileSystemFileHandle);
      if (map) maps.push(map);
    }
  } else if (dirWithEntries.values) {
    for await (const handle of dirWithEntries.values()) {
      if (handle.kind !== "file") continue;
      const map = await readMapFileHandle(handle as FileSystemFileHandle);
      if (map) maps.push(map);
    }
  }

  return maps.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function readCombatMap(id: string): Promise<CombatMapDocument | null> {
  try {
    const dir = await mapsDir();
    const file = await dir.getFileHandle(`${id}.json`);
    return normalizeCombatMapDocument(JSON.parse(await (await file.getFile()).text()));
  } catch {
    return null;
  }
}

export async function writeCombatMap(map: CombatMapDocument): Promise<void> {
  const dir = await mapsDir();
  const file = await dir.getFileHandle(`${map.id}.json`, { create: true });
  const writable = await file.createWritable();
  await writable.write(JSON.stringify(map, null, 2));
  await writable.close();
}

export async function deleteCombatMap(id: string): Promise<void> {
  const dir = await mapsDir();
  await dir.removeEntry(`${id}.json`).catch(() => undefined);
}

import { normalizeLocalSheet, type OpcodeLocalSheet } from "./model";

const ROOT = "opcode";
const SHEETS = "sheets";
const IMAGES = "images";

async function rootDir() {
  const opfs = await navigator.storage.getDirectory();
  return opfs.getDirectoryHandle(ROOT, { create: true });
}

async function sheetsDir() {
  const root = await rootDir();
  return root.getDirectoryHandle(SHEETS, { create: true });
}

async function imagesDir(sheetId: string) {
  const root = await rootDir();
  const images = await root.getDirectoryHandle(IMAGES, { create: true });
  return images.getDirectoryHandle(sheetId, { create: true });
}

export async function opfsAvailable(): Promise<boolean> {
  return typeof navigator !== "undefined" && typeof navigator.storage?.getDirectory === "function";
}

export async function listSheets(): Promise<OpcodeLocalSheet[]> {
  if (!(await opfsAvailable())) return [];
  const dir = await sheetsDir();
  const sheets: OpcodeLocalSheet[] = [];
  const dirWithEntries = dir as FileSystemDirectoryHandle & {
    entries?: () => AsyncIterable<[string, FileSystemHandle]>;
    values?: () => AsyncIterable<FileSystemHandle>;
  };

  if (dirWithEntries.entries) {
    for await (const [name, handle] of dirWithEntries.entries()) {
      if (handle.kind !== "file" || !name.endsWith(".json")) continue;
      const sheet = await readSheetFileHandle(handle as FileSystemFileHandle);
      if (sheet) sheets.push(sheet);
    }
  } else if (dirWithEntries.values) {
    for await (const handle of dirWithEntries.values()) {
      if (handle.kind !== "file") continue;
      const sheet = await readSheetFileHandle(handle as FileSystemFileHandle);
      if (sheet) sheets.push(sheet);
    }
  }

  return sheets.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

async function readSheetFileHandle(handle: FileSystemFileHandle): Promise<OpcodeLocalSheet | null> {
  try {
    const file = await handle.getFile();
    return normalizeLocalSheet(JSON.parse(await file.text()));
  } catch {
    return null;
  }
}

export async function readSheet(id: string): Promise<OpcodeLocalSheet | null> {
  try {
    const dir = await sheetsDir();
    const file = await dir.getFileHandle(`${id}.json`);
    return normalizeLocalSheet(JSON.parse(await (await file.getFile()).text()));
  } catch {
    return null;
  }
}

export async function writeSheet(sheet: OpcodeLocalSheet): Promise<void> {
  const dir = await sheetsDir();
  const file = await dir.getFileHandle(`${sheet.id}.json`, { create: true });
  const writable = await file.createWritable();
  await writable.write(JSON.stringify(sheet, null, 2));
  await writable.close();
}

export async function deleteSheet(id: string): Promise<void> {
  const dir = await sheetsDir();
  await dir.removeEntry(`${id}.json`).catch(() => undefined);
  const root = await rootDir();
  const images = await root.getDirectoryHandle(IMAGES, { create: true }).catch(() => null);
  await images?.removeEntry(id, { recursive: true }).catch(() => undefined);
}

export async function writeImage(sheetId: string, imageId: string, blob: Blob): Promise<void> {
  const dir = await imagesDir(sheetId);
  const file = await dir.getFileHandle(imageId, { create: true });
  const writable = await file.createWritable();
  await writable.write(blob);
  await writable.close();
}

export async function readImage(sheetId: string, imageId: string): Promise<Blob | null> {
  try {
    const dir = await imagesDir(sheetId);
    const file = await dir.getFileHandle(imageId);
    return await file.getFile();
  } catch {
    return null;
  }
}

export async function deleteImage(sheetId: string, imageId: string): Promise<void> {
  const dir = await imagesDir(sheetId);
  await dir.removeEntry(imageId).catch(() => undefined);
}

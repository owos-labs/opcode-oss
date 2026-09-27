export const OPFS_IMAGE_PREFIX = "opfs:";

export function opfsImageSrc(id: string) {
  return `${OPFS_IMAGE_PREFIX}${id}`;
}

export function parseOpfsImageSrc(src: string) {
  return src.startsWith(OPFS_IMAGE_PREFIX) ? src.slice(OPFS_IMAGE_PREFIX.length) : null;
}

export function firstImageFile(files: Iterable<File> | ArrayLike<File> | null | undefined) {
  if (!files) return null;
  for (const file of Array.from(files)) {
    if (file.type.startsWith("image/")) return file;
  }
  return null;
}

export function imageFileFromDataTransfer(data: DataTransfer | null | undefined) {
  if (!data) return null;
  return firstImageFile(data.files) ?? firstImageFile(
    [...data.items]
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file != null),
  );
}

import assert from "node:assert/strict";
import { test } from "node:test";

import { firstImageFile, opfsImageSrc, parseOpfsImageSrc } from "./images.ts";

test("opfs image src roundtrips", () => {
  assert.equal(opfsImageSrc("abc"), "opfs:abc");
  assert.equal(parseOpfsImageSrc("opfs:abc"), "abc");
  assert.equal(parseOpfsImageSrc("https://x"), null);
});

test("firstImageFile picks the first image", () => {
  const png = new File(["x"], "a.png", { type: "image/png" });
  const txt = new File(["y"], "a.txt", { type: "text/plain" });
  assert.equal(firstImageFile([txt, png]), png);
  assert.equal(firstImageFile([txt]), null);
});

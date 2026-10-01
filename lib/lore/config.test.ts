import assert from "node:assert/strict";
import { test } from "node:test";

import { loreGithubRepoUrl, loreLocaleDir } from "./config";

test("loreLocaleDir maps app locales to GitHub content folders", () => {
  assert.equal(loreLocaleDir("zh"), "cn");
  assert.equal(loreLocaleDir("en"), "en");
  assert.equal(loreLocaleDir("ja"), "en");
});

test("loreGithubRepoUrl points at the rulebook repository", () => {
  assert.equal(loreGithubRepoUrl(), "https://github.com/owos-labs/Opcode-D10");
});

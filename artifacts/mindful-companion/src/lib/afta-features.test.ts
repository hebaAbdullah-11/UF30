import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AFTA_FEATURES, aftaHubCopy } from "./afta-features.ts";

test("all existing AFTA capabilities have distinct real entry points", () => {
  assert.deepEqual(AFTA_FEATURES.map(feature => feature.path).sort(), [
    "/daily", "/daily-questions", "/dashboard", "/declutter", "/organize-thoughts", "/user-portal",
  ].sort());
  assert.equal(new Set(AFTA_FEATURES.map(feature => feature.id)).size, AFTA_FEATURES.length);
  assert.equal(new Set(AFTA_FEATURES.map(feature => feature.index)).size, AFTA_FEATURES.length);
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  for (const feature of AFTA_FEATURES) {
    assert.match(app, new RegExp(`<Route path="${feature.path}">\\s*<ProtectedRoute>`), `${feature.id} retains authentication`);
  }
  assert.match(app, /<Route path="\/uf30\/afta" component={UF30Afta}/, "feature browsing remains public");
});

test("each feature and hub message has complete Arabic and English copy", () => {
  assert.deepEqual(Object.keys(aftaHubCopy.ar).sort(), Object.keys(aftaHubCopy.en).sort());
  for (const language of ["ar", "en"] as const) {
    for (const feature of AFTA_FEATURES) {
      assert.ok(feature.title[language].trim());
      assert.ok(feature.body[language].trim());
      assert.ok(feature.tags[language].length);
      assert.ok(feature.tags[language].every(tag => tag.trim().length > 0));
      assert.match(feature.path, /^\/[a-z-]+$/);
    }
    assert.ok(Object.values(aftaHubCopy[language]).every(value => value.trim().length > 0));
    assert.ok(aftaHubCopy[language].accountBody);
    assert.ok(aftaHubCopy[language].noShare);
  }
  assert.equal(AFTA_FEATURES.find(feature => feature.id === "portal")?.optional, true);
});

test("feature catalog remains present before UF30 registration and across spaces", () => {
  const registration = readFileSync(new URL("../pages/uf30-register.tsx", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../pages/uf30-workspace.tsx", import.meta.url), "utf8");
  const landing = readFileSync(new URL("../pages/uf30-landing.tsx", import.meta.url), "utf8");
  assert.match(registration, /<AftaFeatureCatalog lang={lang} compact/);
  assert.match(registration, /href="\/uf30\/afta"/);
  assert.match(workspace, /href="\/uf30\/afta"/);
  assert.match(landing, /data-testid="link-uf30-afta-action"/);
});

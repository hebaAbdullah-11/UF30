import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadConfigFromFile } from "vite";

// Load both release configs without starting servers or reading .env files.
for (const [artifact, defaultBase] of [
  ["mockup-sandbox", "/__mockup/"],
  ["mindful-companion", "/"],
]) {
  test(`${artifact}: build and preview configuration`, async (t) => {
    const originalEnv = { ...process.env };
    const configPath = fileURLToPath(
      new URL(`../${artifact}/vite.config.ts`, import.meta.url),
    );
    async function load(command = "build", isPreview = false) {
      const result = await loadConfigFromFile(
        { command, mode: "production", isPreview },
        configPath,
        undefined,
        "silent",
      );
      assert.ok(result, "Vite must load the config");
      return result.config;
    }
    try {
      // Keep preview instrumentation out of these configuration-only tests.
      process.env.NODE_ENV = "production";
      delete process.env.PORT;
      delete process.env.BASE_PATH;

      await t.test("build has an explicit base and no server port", async () => {
        const config = await load();
        assert.equal(config.base, defaultBase);
        assert.equal(config.server.port, undefined);
        assert.equal(config.preview.port, undefined);
      });
      await t.test("build honors a supplied routed base without a port", async () => {
        process.env.BASE_PATH = "/custom-route/";
        assert.equal((await load()).base, "/custom-route/");
        delete process.env.BASE_PATH;
      });
      await t.test("servers still require preview settings", async () => {
        await assert.rejects(load("serve"), /PORT environment variable is required/);
        await assert.rejects(load("serve", true), /PORT environment variable is required/);
        process.env.PORT = "6200";
        await assert.rejects(load("serve"), /BASE_PATH environment variable is required/);
      });
      await t.test("dev and static preview preserve their port and base", async () => {
        process.env.BASE_PATH = "/custom-route/";
        for (const isPreview of [false, true]) {
          const config = await load("serve", isPreview);
          assert.equal(config.base, "/custom-route/");
          assert.equal(config.server.port, 6200);
          assert.equal(config.preview.port, 6200);
        }
      });
      await t.test("servers reject invalid ports", async () => {
        for (const port of ["no-port", "0", "-1", "1.5", "65536", "Infinity"]) {
          process.env.PORT = port;
          await assert.rejects(load("serve"), /Invalid PORT value/);
        }
      });
    } finally {
      for (const key of ["PORT", "BASE_PATH", "NODE_ENV"]) {
        if (originalEnv[key] === undefined) delete process.env[key];
        else process.env[key] = originalEnv[key];
      }
    }
  });
}

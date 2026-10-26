import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkHtmlAssets } from "@workspace/release-assets";

test("asset checker rejects broken release HTML", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "release-asset-fixture-"));
  try {
    await mkdir(path.join(dir, "assets"));
    await writeFile(path.join(dir, "assets/main.js"), "// entry");
    await writeFile(path.join(dir, "assets/main.css"), "body{}");
    const html = (base) => `
      <script type="module" src="${base}assets/main.js"></script>
      <link rel="stylesheet" href="${base}assets/main.css">
      <link rel="stylesheet" href="https://fonts.example/font.css">
      <link rel="icon" href="data:image/svg+xml,<svg></svg>">`;
    await t.test("accepts root and nested bases, external fonts and inline icons", async () => {
      for (const base of ["/", "/__mockup/", "/custom-route/nested/"]) {
        await checkHtmlAssets(html(base), dir, base);
      }
    });
    await t.test("rejects a wrong prefix even when the file exists", async () => {
      await assert.rejects(checkHtmlAssets(html("/"), dir, "/__mockup/"), /must start with/);
    });
    await t.test("rejects a missing generated asset", async () => {
      await assert.rejects(
        checkHtmlAssets(html("/").replace("main.js", "missing.js"), dir, "/"),
        /does not resolve to a generated file/,
      );
    });
    await t.test("rejects directory traversal", async () => {
      await assert.rejects(
        checkHtmlAssets(html("/custom/").replace("assets/main.js", "../assets/main.js"), dir, "/custom/"),
        /escapes/,
      );
    });
    await t.test("cannot pass when entry scripts or styles disappear", async () => {
      await assert.rejects(checkHtmlAssets('<link rel="stylesheet" href="/assets/main.css">', dir, "/"), /JavaScript entry/);
      await assert.rejects(checkHtmlAssets('<script src="/assets/main.js"></script>', dir, "/"), /stylesheet/);
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("asset checker follows generated CSS and JavaScript dependencies", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "release-dependency-fixture-"));
  try {
    for (const base of ["/", "/__mockup/", "/custom-route/nested/"]) {
      await t.test(`dependency graph at ${base}`, async (t) => {
        const files = {
          "assets/main.js": `
            import "./shared.js";
            export { value } from "./exports.mjs";
            import("./chunks/lazy.js?version=1#chunk");
            import("${base}assets/absolute.js");
            import("https://cdn.example/external.js");
            import("//cdn.example/protocol-relative.js");
            import("data:text/javascript,export default 1");
            import(\`./chunks/template.js\`);
            const runtimeName = "runtime-only";
            import(runtimeName);
            import(\`./chunks/\${runtimeName}.js\`);
            const moduleUrl = import.meta.url;
            const ordinaryString = "import('./not-a-dependency.js')";
            // import("./commented-out.js");
          `,
          "assets/shared.js": 'import "./main.js";',
          "assets/exports.mjs": "export const value = 1;",
          "assets/absolute.js": "// absolute chunk",
          "assets/chunks/template.js": "// literal template import",
          "assets/chunks/lazy.js": 'import "../deep.js";',
          "assets/deep.js": "// nested dependency",
          "assets/main.css": `
            @import "./styles/theme.css" screen;
            @import url('./styles/url-import.css') layer(theme);
            @import "https://fonts.example/external.css";
            @import url("//fonts.example/external.css");
            body { background: url("${base}assets/absolute.svg?x=1#icon"); }
            .external { background: url(https://images.example/photo.png); }
            .inline { background: url("data:image/svg+xml,<svg></svg>"); }
            .fragment { filter: url(#local-filter); }
            .text::after { content: "url(missing-but-not-a-resource.png)"; }
            /* .unused { background: url(missing-comment.png); } */
          `,
          "assets/styles/theme.css": `
            @import "../main.css";
            @font-face { font-family: test; src: url(../font.woff2?v=2); }
            .nested { background-image: url('../nested%20image.svg#icon'); }
          `,
          "assets/styles/url-import.css": "body { color: red; }",
          "assets/font.woff2": "fixture-font",
          "assets/nested image.svg": "<svg/>",
          "assets/absolute.svg": "<svg/>",
        };
        for (const [name, content] of Object.entries(files)) {
          await mkdir(path.dirname(path.join(dir, name)), { recursive: true });
          await writeFile(path.join(dir, name), content);
        }
        const html = `<script type="module" src="${base}assets/main.js"></script>
          <link rel="stylesheet" href="${base}assets/main.css">`;
        await t.test("accepts relative, absolute, cyclic and external references", async () => {
          await checkHtmlAssets(html, dir, base);
        });
        for (const missing of [
          "assets/deep.js",
          "assets/chunks/lazy.js",
          "assets/chunks/template.js",
          "assets/exports.mjs",
          "assets/styles/theme.css",
          "assets/styles/url-import.css",
          "assets/font.woff2",
          "assets/nested image.svg",
          "assets/absolute.svg",
        ]) {
          await t.test(`rejects missing nested resource ${missing}`, async () => {
            await rm(path.join(dir, missing));
            try {
              await assert.rejects(checkHtmlAssets(html, dir, base), (error) => {
                assert.match(error.message, /referenced by.*does not resolve to a generated file/);
                assert.ok(error.message.includes(path.join(dir, missing)), error.message);
                return true;
              });
            } finally {
              await writeFile(path.join(dir, missing), files[missing]);
            }
          });
        }
        await t.test("rejects empty nested files", async () => {
          const file = path.join(dir, "assets/deep.js");
          await writeFile(file, "");
          try {
            await assert.rejects(checkHtmlAssets(html, dir, base), /must resolve to a nonempty file/);
          } finally {
            await writeFile(file, files["assets/deep.js"]);
          }
        });
        await t.test("rejects nested references escaping the routed output", async () => {
          for (const reference of ["../../../../outside.js", `${base}%2e%2e/outside.js`, `${base}assets/%2e%2e%2f%2e%2e%2foutside.js`]) {
            await writeFile(path.join(dir, "assets/chunks/lazy.js"), `import(${JSON.stringify(reference)});`);
            try {
              await assert.rejects(checkHtmlAssets(html, dir, base), /escapes|does not resolve to a generated file/);
            } finally {
              await writeFile(path.join(dir, "assets/chunks/lazy.js"), files["assets/chunks/lazy.js"]);
            }
          }
        });
        if (base !== "/") {
          await t.test("rejects a nested absolute reference with the wrong prefix", async () => {
            await writeFile(path.join(dir, "assets/chunks/lazy.js"), 'import("/assets/deep.js");');
            try {
              await assert.rejects(checkHtmlAssets(html, dir, base), /must start with/);
            } finally {
              await writeFile(path.join(dir, "assets/chunks/lazy.js"), files["assets/chunks/lazy.js"]);
            }
          });
        }
      });
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

for (const [artifact, defaultBase] of [
  ["mockup-sandbox", "/__mockup/"],
  ["mindful-companion", "/"],
]) {
  for (const brokenType of ["HTML", "CSS", "JavaScript"]) {
  test(`${artifact}: its Vite build fails on broken emitted ${brokenType}`, { timeout: 60_000 }, async () => {
    const root = fileURLToPath(new URL(`../${artifact}/`, import.meta.url));
    const fixture = await mkdtemp(path.join(tmpdir(), `${artifact}-broken-release-`));
    const env = { ...process.env, NODE_ENV: "production", BASE_PATH: "/custom-route/nested/" };
    delete env.PORT;
    try {
      await writeFile(path.join(fixture, "index.html"),
        '<script type="module" src="/main.js"></script>');
      await writeFile(path.join(fixture, "main.js"), 'import "./main.css"; console.info("fixture");');
      await writeFile(path.join(fixture, "main.css"), "body { color: red; }");
      // Keep the artifact's real config/plugins, but compile a tiny independent
      // fixture. Inject a broken reference after Vite's HTML transformation.
      // The process must fail inside Vite, without a separate checker invocation.
      const result = spawnSync(process.execPath, [
        "--input-type=module",
        "-e",
        `import { build } from "vite";
         await build({
           root: ${JSON.stringify(fixture)},
           configFile: ${JSON.stringify(path.join(root, "vite.config.ts"))},
           envFile: false,
           logLevel: "warn",
           plugins: [{
             name: "inject-broken-release-reference",
             transformIndexHtml: {
               order: "post",
               handler(html) {
                 return ${JSON.stringify(brokenType)} === "HTML"
                   ? html + '<script src="/custom-route/nested/assets/missing.js"></script>'
                   : html;
               }
             },
             generateBundle: {
               order: "post",
               handler(_, bundle) {
                 const brokenType = ${JSON.stringify(brokenType)};
                 if (brokenType === "HTML") return;
                 const entry = Object.values(bundle).find((file) =>
                   brokenType === "CSS"
                     ? file.type === "asset" && file.fileName.endsWith(".css")
                     : file.type === "chunk" && file.isEntry);
                 if (!entry) throw new Error("Fixture has no emitted dependency entry");
                 if (brokenType === "CSS") entry.source += '\\nbody { background: url("./missing.png"); }';
                 else entry.code += '\\nimport("./missing.js");';
               }
             }
           }],
           build: { outDir: ${JSON.stringify(path.join(fixture, "dist"))}, emptyOutDir: true }
         });`,
      ], { cwd: root, env, encoding: "utf8", timeout: 45_000, maxBuffer: 8 * 1024 * 1024 });
      assert.ifError(result.error);
      assert.notEqual(result.status, 0, `A direct Vite build must reject broken ${brokenType}`);
      assert.match(result.stderr, /release-html-assets/);
      assert.match(result.stderr, /missing\.(?:js|png).*does not resolve to a generated file/);
    } finally {
      await rm(fixture, { recursive: true, force: true });
    }
  });
  }

  for (const customBase of [undefined, "/custom-route/nested/"]) {
    const expectedBase = customBase ?? defaultBase;
    test(`${artifact}: release assets at ${expectedBase}`, { timeout: 180_000 }, async () => {
      const root = fileURLToPath(new URL(`../${artifact}/`, import.meta.url));
      const outDir = await mkdtemp(path.join(tmpdir(), `${artifact}-release-`));
      const env = { ...process.env, NODE_ENV: "production" };
      delete env.PORT;
      delete env.BASE_PATH;
      if (customBase !== undefined) env.BASE_PATH = customBase;
      try {
        // A fresh process per build isolates Vite/plugin state and environment.
        // Disable .env loading so local credentials or routing settings cannot
        // change this account-free, database-free release matrix.
        const result = spawnSync(process.execPath, [
          "--input-type=module",
          "-e",
          `import { build } from "vite";
           await build({
             root: ${JSON.stringify(root)},
             configFile: ${JSON.stringify(path.join(root, "vite.config.ts"))},
             envFile: false,
             logLevel: "warn",
             build: { outDir: ${JSON.stringify(outDir)}, emptyOutDir: true }
           });`,
        ], { cwd: root, env, encoding: "utf8", timeout: 150_000, maxBuffer: 8 * 1024 * 1024 });
        assert.ifError(result.error);
        assert.equal(result.status, 0, `Release build failed:\n${result.stdout}\n${result.stderr}`);
        await checkHtmlAssets(await readFile(path.join(outDir, "index.html"), "utf8"), outDir, expectedBase);
      } finally {
        // Never overwrite either app's normal dist output or leave fixtures.
        await rm(outDir, { recursive: true, force: true });
      }
    });
  }
}

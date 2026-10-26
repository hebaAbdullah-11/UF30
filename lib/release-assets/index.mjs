import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createAssetVisitor } from "./dependencies.mjs";

// Seed the dependency traversal from resource URLs, not navigation links.
// Quoted attributes may contain ">" (the Canvas inline SVG favicon).
export async function checkHtmlAssets(html, outDir, base) {
  const resources = [];
  const visit = createAssetVisitor(outDir, base);
  const tags = html.replace(/<!--[\s\S]*?-->/g, "").matchAll(
    /<(script|link|img|source)\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi,
  );
  for (const [tag, name] of tags) {
    const attribute = name.toLowerCase() === "link" ? "href" : "src";
    const match = tag.match(new RegExp(`\\b${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
    if (!match) continue;
    const url = match[1] ?? match[2] ?? match[3];
    // External fonts, preconnects and data URLs are not generated files.
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url)) continue;
    await visit(url, `${base}index.html`, true);
    const pathname = decodeURIComponent(new URL(url, "https://release.invalid").pathname);
    resources.push({ name: name.toLowerCase(), pathname, tag });
  }
  assert.ok(
    resources.some(({ name, pathname }) => name === "script" && pathname.endsWith(".js")),
    "HTML must reference a generated JavaScript entry",
  );
  assert.ok(
    resources.some(({ name, pathname, tag }) =>
      name === "link" && pathname.endsWith(".css") && /\brel\s*=\s*["']stylesheet["']/i.test(tag)),
    "HTML must reference a generated stylesheet",
  );
}

// Runs inside each artifact's existing Vite build: no subprocesses, extra
// builds, servers, credentials, or database access.
export function releaseAssetsPlugin() {
  let config;
  return {
    name: "release-html-assets",
    apply: "build",
    enforce: "post",
    configResolved(resolved) {
      config = resolved;
    },
    writeBundle: {
      order: "post",
      sequential: true,
      async handler(output) {
        const outDir = path.resolve(config.root, output.dir ?? config.build.outDir);
        await checkHtmlAssets(
          await readFile(path.join(outDir, "index.html"), "utf8"),
          outDir,
          config.base,
        );
        config.logger.info("Release HTML, CSS and JavaScript asset references validated.");
      },
    },
  };
}

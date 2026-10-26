import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { init, parse } from "es-module-lexer";
import postcss from "postcss";
import valueParser from "postcss-value-parser";

const origin = "https://release.invalid";
const isExternal = (url) => /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url);

function cssReferences(source, file) {
  const references = [];
  const css = postcss.parse(source, { from: file });
  function collectUrls(value) {
    valueParser(value).walk((node) => {
      if (node.type !== "function" || node.value.toLowerCase() !== "url") return;
      const content = node.nodes.filter(({ type }) => type !== "comment" && type !== "space");
      references.push(content.length === 1 && content[0].type === "string"
        ? content[0].value
        : valueParser.stringify(node.nodes).trim());
      return false;
    });
  }
  css.walkDecls(({ value }) => collectUrls(value));
  css.walkAtRules((rule) => {
    collectUrls(rule.params);
    if (rule.name.toLowerCase() !== "import") return;
    const first = valueParser(rule.params).nodes.find(({ type }) => type !== "space" && type !== "comment");
    if (first?.type === "string") references.push(first.value);
  });
  return references;
}

// Traverse only dependencies, not arbitrary JS strings (routes, API URLs, etc.).
// Runtime-computed imports have no fixed generated filename to check.
export function createAssetVisitor(outDir, base) {
  const visited = new Set();
  return async function visit(url, importer = `${base}index.html`, htmlEntry = false) {
    if (!url || isExternal(url)) return;
    const context = `Asset URL "${url}" referenced by "${importer}"`;
    if (htmlEntry || url.startsWith("/")) {
      assert.ok(url.startsWith(base), `${context} must start with "${base}"`);
    }
    const pathname = decodeURIComponent(new URL(url, new URL(importer, origin)).pathname);
    assert.ok(pathname.startsWith(base), `${context} escapes "${base}"`);
    const file = path.resolve(outDir, pathname.slice(base.length));
    assert.ok(
      file.startsWith(`${path.resolve(outDir)}${path.sep}`),
      `${context} escapes the build directory`,
    );
    if (visited.has(file)) return;
    const info = await stat(file).catch((error) => {
      throw new Error(`${context} does not resolve to a generated file: ${file}`, { cause: error });
    });
    assert.ok(info.isFile() && info.size > 0, `${context} must resolve to a nonempty file`);
    visited.add(file); // Cyclic CSS imports and shared chunks must terminate.
    const extension = path.extname(file).toLowerCase();
    if (![".css", ".js", ".mjs"].includes(extension)) return;
    const source = await readFile(file, "utf8");
    let references;
    if (extension === ".css") {
      references = cssReferences(source, file);
    } else {
      await init;
      // Includes static imports, re-exports, and literal dynamic imports.
      // import.meta has no specifier; interpolated templates are globs, not
      // emitted filenames. The lexer prevents matches in comments or strings.
      references = parse(source, file)[0].flatMap(({ specifier, glob }) =>
        typeof specifier === "string" && !glob ? [specifier] : []);
    }
    for (const reference of references) await visit(reference, pathname);
  };
}

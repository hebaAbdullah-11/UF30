import type { Plugin } from "vite";

export function checkHtmlAssets(html: string, outDir: string, base: string): Promise<void>;
export function releaseAssetsPlugin(): Plugin;

#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const args = process.argv.slice(2);

function printUsage() {
  console.error("Usage: node generate_sitemap.mjs <base-url> [output-file]");
  console.error(
    "Example: node generate_sitemap.mjs https://dzsodzso63.github.io/iwiw_forum sitemap.xml"
  );
}

if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  printUsage();
  process.exit(args.length === 0 ? 1 : 0);
}

const [baseUrlArg, outputArg = "sitemap.xml"] = args;

let baseUrl;

try {
  baseUrl = new URL(baseUrlArg);
} catch {
  console.error(`Invalid base URL: ${baseUrlArg}`);
  printUsage();
  process.exit(1);
}

if (!baseUrl.protocol.startsWith("http")) {
  console.error("Base URL must start with http:// or https://");
  process.exit(1);
}

const basePath = `${baseUrl.pathname.replace(/\/+$/, "")}/`;

const ignoredDirs = new Set([
  ".git",
  ".github",
  ".jekyll-cache",
  "_site",
  "node_modules",
  "vendor",
]);

const ignoredFiles = new Set(["sitemap.xml"]);

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(rootDir, fullPath);

    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name) || entry.name.startsWith(".")) {
        continue;
      }

      files.push(...(await walk(fullPath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (ignoredFiles.has(entry.name)) {
      continue;
    }

    if (!entry.name.endsWith(".html")) {
      continue;
    }

    files.push(relativePath);
  }

  return files;
}

function toSitePath(relativeFilePath) {
  const normalizedPath = relativeFilePath.split(path.sep).join("/");

  if (normalizedPath === "index.html") {
    return "/";
  }

  if (normalizedPath.endsWith("/index.html")) {
    return `/${normalizedPath.slice(0, -"index.html".length)}`;
  }

  return `/${normalizedPath}`;
}

function toAbsoluteUrl(sitePath) {
  const relativeSitePath = sitePath === "/" ? "" : sitePath.slice(1);
  return new URL(relativeSitePath, `${baseUrl.origin}${basePath}`).toString();
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatLastMod(date) {
  return new Date(date - 1000000000).toISOString().split("T")[0];
}

async function buildSitemapEntries(files) {
  const entries = [];

  for (const relativeFilePath of files.sort()) {
    const fullPath = path.join(rootDir, relativeFilePath);
    const stat = await fs.stat(fullPath);
    const loc = toAbsoluteUrl(toSitePath(relativeFilePath));

    entries.push({
      loc,
      lastmod: formatLastMod(stat.mtime),
    });
  }

  return entries;
}

async function main() {
  const htmlFiles = await walk(rootDir);
  const entries = await buildSitemapEntries(htmlFiles);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
    ${entries
      .map(
        ({ loc, lastmod }) => `
  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>${
      loc.endsWith("_1.html") ? 0.8 : loc.endsWith(".html") ? 0.4 : 1.0
    }</priority>
  </url>`
      )
      .join("")}
</urlset>`;

  await fs.writeFile(path.resolve(rootDir, outputArg), xml, "utf8");
  console.log(`Wrote ${entries.length} URLs to ${outputArg}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

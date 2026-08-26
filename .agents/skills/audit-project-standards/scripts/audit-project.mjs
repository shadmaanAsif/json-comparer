#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, extname, join, relative, resolve, sep } from "node:path";

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const requestedRoot = args.find((arg) => !arg.startsWith("--"));
const root = findProjectRoot(resolve(requestedRoot ?? process.cwd()));
const findings = [];

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".css"]);
const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "public"
]);
const GENERIC_MODULE_NAMES = new Set(["common", "helper", "helpers", "misc", "shared", "stuff"]);

function findProjectRoot(start) {
  let current = start;
  while (true) {
    if (existsSync(join(current, "package.json"))) return current;
    const parent = resolve(current, "..");
    if (parent === current) throw new Error(`No package.json found from ${start}.`);
    current = parent;
  }
}

function collectFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return IGNORED_DIRECTORIES.has(entry.name) ? [] : collectFiles(path);
    }
    return entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name)) ? [path] : [];
  });
}

function report(severity, file, rule, detail) {
  findings.push({ severity, file: relative(root, file) || ".", rule, detail });
}

function importsOf(source) {
  return [...source.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[^"']+?\s+from\s+)?["']([^"']+)["']/g)].map(
    (match) => match[1]
  );
}

function checkNaming(file) {
  const projectPath = relative(root, file).split(sep).join("/");
  const name = basename(file, extname(file));
  const isTest = /\.(?:test|spec)$/.test(name);
  const baseName = name.replace(/\.(?:test|spec)$/, "");

  if (/\/components\/[^/]+\.tsx$/.test(`/${projectPath}`) && !/^[A-Z][A-Za-z0-9]*$/.test(baseName)) {
    report("error", file, "component-filename", "React component files must use PascalCase.");
  }
  if (/\/hooks\/[^/]+\.(?:ts|tsx)$/.test(`/${projectPath}`) && !/^use[A-Z][A-Za-z0-9]*$/.test(baseName)) {
    report("error", file, "hook-filename", "Hook files must use usePascalCase naming.");
  }
  if (
    !isTest &&
    /\/(?:services|utils|domain|server)\//.test(`/${projectPath}`) &&
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(baseName)
  ) {
    report("warning", file, "module-filename", "Non-component modules should use descriptive kebab-case.");
  }
  if (GENERIC_MODULE_NAMES.has(baseName.toLowerCase())) {
    report("warning", file, "generic-name", "Use a responsibility-specific module name.");
  }
}

function checkSize(file, source) {
  const projectPath = relative(root, file).split(sep).join("/");
  const lines = source.split(/\r?\n/).length;
  let threshold = 650;
  if (file.endsWith(".css")) threshold = 1500;
  else if (projectPath.startsWith("src/domain/") || projectPath.startsWith("src/server/")) {
    threshold = 400;
  } else if (projectPath.startsWith("app/api/")) {
    threshold = 180;
  }
  if (lines > threshold) {
    report(
      "warning",
      file,
      "module-size",
      `${lines} lines exceeds the ${threshold}-line review threshold; verify that responsibilities remain cohesive.`
    );
  }
}

function checkImports(file, source) {
  const projectPath = relative(root, file).split(sep).join("/");
  const imports = importsOf(source);

  for (const imported of imports) {
    if (imported.startsWith("@/src/")) {
      report("error", file, "legacy-alias", "Use @/ as the src/ root; remove the redundant src segment.");
    }
    if (/^(?:\.\.\/){3,}/.test(imported)) {
      report("warning", file, "deep-relative-import", "Use the configured source alias across module boundaries.");
    }
  }

  if (projectPath.startsWith("src/domain/")) {
    const forbidden = imports.find(
      (value) =>
        /^(?:react|next(?:\/|$)|node:)/.test(value) ||
        /^@\/(?:features|server|workers)(?:\/|$)/.test(value)
    );
    if (forbidden) {
      report("error", file, "domain-dependency", `Domain code imports outward from ${forbidden}.`);
    }
  }
  if (projectPath.startsWith("src/features/") && imports.some((value) => /^@\/server(?:\/|$)/.test(value))) {
    report("error", file, "feature-server-dependency", "Feature code must reach server behavior through an API service.");
  }
  if (
    projectPath.startsWith("src/features/") &&
    !projectPath.includes("/services/") &&
    /\bfetch\s*\(/.test(source)
  ) {
    report("warning", file, "feature-io-boundary", "Move browser data fetching into the feature's services directory.");
  }
}

function checkDirectoryNames(file) {
  const directories = relative(root, file).split(sep).slice(0, -1);
  const invalid = directories.find((directory) => !/^[a-z0-9.]+(?:-[a-z0-9]+)*$/.test(directory));
  if (invalid) {
    report("warning", file, "directory-name", `Directory '${invalid}' should use lowercase kebab-case.`);
  }
}

const files = [join(root, "app"), join(root, "src")].flatMap(collectFiles);
if (files.length === 0) throw new Error(`No source files found in ${root}.`);

for (const file of files) {
  const source = readFileSync(file, "utf8");
  checkNaming(file);
  checkSize(file, source);
  checkImports(file, source);
  checkDirectoryNames(file);
}

const severityRank = { error: 0, warning: 1 };
findings.sort(
  (a, b) =>
    severityRank[a.severity] - severityRank[b.severity] ||
    a.file.localeCompare(b.file) ||
    a.rule.localeCompare(b.rule)
);

for (const finding of findings) {
  console.log(`[${finding.severity.toUpperCase()}] ${finding.file} (${finding.rule})`);
  console.log(`  ${finding.detail}`);
}

const errors = findings.filter((finding) => finding.severity === "error").length;
const warnings = findings.length - errors;
console.log(`Project standards audit: ${files.length} files, ${errors} errors, ${warnings} warnings.`);

if (errors > 0 || (strict && warnings > 0)) process.exitCode = 1;

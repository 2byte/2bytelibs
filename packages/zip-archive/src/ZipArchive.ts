import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import type { Logger } from "./Logger.ts";

export type ArchiveResult = {
  data: Buffer;
  extension: ".zip" | ".tar.gz";
};

export interface ZipArchiveOptions {
  /**
   * Ignore patterns applied when building the archive.
   * Supports directory names, file masks (*.log), path-based patterns (dist/node_modules),
   * and glob wildcards (* and **).
   */
  ignores?: string[];
  /**
   * Default ignores merged with user-provided ones.
   * Defaults to ["node_modules", ".git", ".github", ".env"].
   */
  defaultIgnores?: string[];
  /** Optional logger instance. When omitted, no log output is produced. */
  logger?: Logger;
}

export class ZipArchive {
  private ignores: string[];
  private defaultIgnores: string[];
  private logger?: Logger;

  constructor(options: ZipArchiveOptions = {}) {
    this.defaultIgnores = options.defaultIgnores ?? ["node_modules", ".git", ".github", ".env"];
    this.ignores = options.ignores ?? [];
    this.logger = options.logger;
  }

  public setIgnores(ignores: string[]): void {
    this.ignores = ignores;
  }

  public addIgnores(ignores: string[]): void {
    this.ignores = Array.from(new Set([...this.ignores, ...ignores]));
  }

  public setDefaultIgnores(defaults: string[]): void {
    this.defaultIgnores = defaults;
  }

  public addDefaultIgnores(defaults: string[]): void {
    this.defaultIgnores = Array.from(new Set([...this.defaultIgnores, ...defaults]));
  }

  public getDefaultIgnores(): string[] {
    return [...this.defaultIgnores];
  }

  public getIgnores(): string[] {
    return [...this.ignores];
  }

  /**
   * Create an archive from a directory.
   * Returns a ZIP on Windows (PowerShell) and tar.gz on Unix-like systems.
   */
  public createArchiveFromDirectory(dirPath: string): ArchiveResult {
    const stagingDir = this.stageDirectoryForArchiving(dirPath);

    try {
      if (process.platform === "win32") {
        return { data: this.createZipWithPowerShell(stagingDir), extension: ".zip" };
      }

      return { data: this.createTarGzWithTar(stagingDir), extension: ".tar.gz" };
    } finally {
      rmSync(stagingDir, { recursive: true, force: true });
    }
  }

  /**
   * Extract an archive (ZIP or tar.gz/tar) into extractPath.
   */
  public extractArchive(filename: string, data: Buffer, extractPath: string): void {
    if (!existsSync(extractPath)) {
      mkdirSync(extractPath, { recursive: true });
    }

    try {
      if (filename.toLowerCase().endsWith(".zip")) {
        this.extractZipArchive(data, extractPath);
      } else if (
        filename.toLowerCase().endsWith(".tar.gz") ||
        filename.toLowerCase().endsWith(".tgz") ||
        filename.toLowerCase().endsWith(".tar")
      ) {
        this.extractTarArchive(filename, data, extractPath);
      } else {
        throw new Error(`Unsupported archive type for ${filename}`);
      }

      this.logger?.success(`Extracted ${filename} to ${extractPath}`);
    } catch (error) {
      this.logger?.error(`Failed to extract ${filename}: ${error}`);
      throw new Error(`Extraction failed: ${filename} to ${extractPath}`, { cause: error });
    }
  }

  // ─── Private: pattern matching ─────────────────────────────────────────────

  private getEffectiveIgnorePatterns(): string[] {
    const merged = Array.from(new Set([...this.ignores, ...this.defaultIgnores]));
    return merged
      .map((p) => this.normalizePattern(p))
      .filter((p) => p.length > 0);
  }

  private normalizePattern(pattern: string): string {
    return pattern.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  }

  private normalizeRelativePath(relativePath: string): string {
    return relativePath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\//, "");
  }

  private hasGlob(pattern: string): boolean {
    return /[*?]/.test(pattern);
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
  }

  private globToRegExp(pattern: string): RegExp {
    let regex = "^";

    for (let i = 0; i < pattern.length; i++) {
      const cur = pattern[i] ?? "";
      const next = pattern[i + 1];

      if (cur === "*" && next === "*") {
        regex += ".*";
        i += 1;
        continue;
      }

      if (cur === "*") { regex += "[^/]*"; continue; }
      if (cur === "?") { regex += "[^/]"; continue; }

      regex += this.escapeRegExp(cur);
    }

    return new RegExp(regex + "$");
  }

  private getBaseName(relativePath: string): string {
    const segments = relativePath.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? "";
  }

  private matchesIgnorePattern(relativePath: string, isDirectory: boolean): boolean {
    const norm = this.normalizeRelativePath(relativePath);
    const base = this.getBaseName(norm);
    const segments = norm.split("/").filter(Boolean);

    for (const pattern of this.getEffectiveIgnorePatterns()) {
      const pathBased = pattern.includes("/");
      const isGlob = this.hasGlob(pattern);

      if (pathBased) {
        if (isGlob) {
          if (this.globToRegExp(pattern).test(norm)) return true;
          continue;
        }
        if (norm === pattern || norm.startsWith(pattern + "/")) return true;
        continue;
      }

      if (isGlob) {
        if (this.globToRegExp(pattern).test(base)) return true;
        continue;
      }

      if (isDirectory && segments.includes(pattern)) return true;
      if (!isDirectory && (base === pattern || segments.includes(pattern))) return true;
    }

    return false;
  }

  // ─── Private: staging ──────────────────────────────────────────────────────

  private stageDirectoryForArchiving(sourceDir: string): string {
    const stagingDir = mkdtempSync(join(tmpdir(), "zip-archive-"));
    let copied = 0;

    const walk = (currentSourceDir: string, currentRelativeDir: string): void => {
      for (const entry of readdirSync(currentSourceDir, { withFileTypes: true })) {
        const relativePath = currentRelativeDir
          ? `${currentRelativeDir}/${entry.name}`
          : entry.name;

        if (entry.isDirectory()) {
          if (this.matchesIgnorePattern(relativePath, true)) {
            this.logger?.info(`Ignoring directory: ${relativePath}`);
            continue;
          }
          mkdirSync(join(stagingDir, relativePath), { recursive: true });
          copied += 1;
          walk(join(currentSourceDir, entry.name), relativePath);
          continue;
        }

        if (!entry.isFile()) {
          this.logger?.warn(`Skipping unsupported entry: ${relativePath}`);
          continue;
        }

        if (this.matchesIgnorePattern(relativePath, false)) {
          this.logger?.info(`Ignoring file: ${relativePath}`);
          continue;
        }

        const dest = join(stagingDir, relativePath);
        mkdirSync(dirname(dest), { recursive: true });
        copyFileSync(join(currentSourceDir, entry.name), dest);
        copied += 1;
      }
    };

    walk(sourceDir, "");

    if (copied === 0) {
      rmSync(stagingDir, { recursive: true, force: true });
      throw new Error("No files available for archiving after applying ignore rules");
    }

    return stagingDir;
  }

  // ─── Private: archive creation ─────────────────────────────────────────────

  private createZipWithPowerShell(stagingDir: string): Buffer {
    const base = dirname(stagingDir);
    const tempZipPath = join(base, `temp_${Date.now()}.zip`);
    const tempScriptPath = join(base, `temp_script_${Date.now()}.ps1`);

    try {
      const psScript = `
param([string]$zipPath)
$items = Get-ChildItem -LiteralPath . -Force | Select-Object -ExpandProperty FullName
if (-not $items) { Write-Error "No files to archive"; exit 1 }
Compress-Archive -LiteralPath $items -DestinationPath $zipPath -Force -ErrorAction Stop
`;
      writeFileSync(tempScriptPath, psScript);

      const result = spawnSync(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", tempScriptPath, tempZipPath],
        { cwd: stagingDir, encoding: "utf-8", windowsHide: true, timeout: 5 * 60 * 1000 },
      );

      if (result.error || result.status !== 0) {
        throw new Error(`PowerShell archive failed: ${result.stderr || result.error}`);
      }
      if (!existsSync(tempZipPath)) throw new Error("PowerShell archive was not created");

      const data = readFileSync(tempZipPath);
      this.logger?.info(`Archive created: ${data.length} bytes`);
      return data;
    } finally {
      rmSync(tempZipPath, { force: true });
      rmSync(tempScriptPath, { force: true });
    }
  }

  private createTarGzWithTar(stagingDir: string): Buffer {
    const tempPath = join(dirname(stagingDir), `temp_${Date.now()}.tar.gz`);

    try {
      const result = spawnSync("tar", ["-czf", tempPath, "-C", stagingDir, "."], {
        encoding: "utf-8",
        windowsHide: true,
        timeout: 5 * 60 * 1000,
      });

      if (result.error || result.status !== 0) {
        throw new Error(`tar failed: ${result.stderr || result.error}`);
      }
      if (!existsSync(tempPath)) throw new Error("tar archive was not created");

      const data = readFileSync(tempPath);
      this.logger?.info(`Archive created: ${data.length} bytes`);
      return data;
    } finally {
      rmSync(tempPath, { force: true });
    }
  }

  // ─── Private: extraction ───────────────────────────────────────────────────

  private extractZipArchive(data: Buffer, extractPath: string): void {
    const tempZipPath = join(extractPath, `temp_${Date.now()}.zip`);

    try {
      writeFileSync(tempZipPath, data);

      if (process.platform === "win32") {
        const result = spawnSync(
          "powershell.exe",
          ["-Command", `Expand-Archive -Path "${tempZipPath}" -DestinationPath "${extractPath}" -Force`],
          { encoding: "utf-8", windowsHide: true, timeout: 120000 },
        );
        if (result.error || result.status !== 0) {
          throw new Error(`PowerShell extract failed: ${result.stderr || result.error}`);
        }
        return;
      }

      const unzip = spawnSync("unzip", ["-o", tempZipPath, "-d", extractPath], {
        encoding: "utf-8", windowsHide: true, timeout: 120000,
      });
      if (!unzip.error && unzip.status === 0) return;

      const tar = spawnSync("tar", ["-xf", tempZipPath, "-C", extractPath], {
        encoding: "utf-8", windowsHide: true, timeout: 120000,
      });
      if (tar.error || tar.status !== 0) {
        throw new Error(`ZIP extract failed: ${unzip.stderr || tar.stderr || tar.error}`);
      }
    } finally {
      rmSync(tempZipPath, { force: true });
    }
  }

  private extractTarArchive(filename: string, data: Buffer, extractPath: string): void {
    const suffix = filename.toLowerCase().endsWith(".tar") ? ".tar" : ".tar.gz";
    const tempPath = join(extractPath, `temp_${Date.now()}${suffix}`);

    try {
      writeFileSync(tempPath, data);

      const args = suffix === ".tar"
        ? ["-xf", tempPath, "-C", extractPath]
        : ["-xzf", tempPath, "-C", extractPath];

      const result = spawnSync("tar", args, {
        encoding: "utf-8", windowsHide: true, timeout: 120000,
      });
      if (result.error || result.status !== 0) {
        throw new Error(`tar extract failed: ${result.stderr || result.error}`);
      }
    } finally {
      rmSync(tempPath, { force: true });
    }
  }
}

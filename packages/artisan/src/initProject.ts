import fs from 'fs';
import path from 'path';

export interface InitProjectOptions {
  rootDir?: string;
  dbPath?: string;
  migrationsPath?: string;
  modelsPath?: string;
  artisanPath?: string;
  createExampleModel?: boolean;
  exampleModelName?: string;
  force?: boolean;
}

export interface InitProjectResult {
  created: string[];
  skipped: string[];
}

const DEFAULTS = {
  dbPath: './database/db.sqlite3',
  migrationsPath: './database/migrations',
  modelsPath: './models',
  artisanPath: './artisan.ts',
  createExampleModel: true,
  exampleModelName: 'Example',
  force: false,
} as const;

export function initProject(options: InitProjectOptions = {}): InitProjectResult {
  const rootDir = options.rootDir ?? process.cwd();
  const dbPath = options.dbPath ?? DEFAULTS.dbPath;
  const migrationsPath = options.migrationsPath ?? DEFAULTS.migrationsPath;
  const modelsPath = options.modelsPath ?? DEFAULTS.modelsPath;
  const artisanPath = options.artisanPath ?? DEFAULTS.artisanPath;
  const createExampleModel = options.createExampleModel ?? DEFAULTS.createExampleModel;
  const exampleModelName = options.exampleModelName ?? DEFAULTS.exampleModelName;
  const force = options.force ?? DEFAULTS.force;

  if (createExampleModel && !/^[A-Z][A-Za-z0-9]*$/.test(exampleModelName)) {
    throw new Error('exampleModelName must be in PascalCase (e.g. ExampleModel).');
  }

  const created: string[] = [];
  const skipped: string[] = [];

  const absDbPath = path.resolve(rootDir, dbPath);
  const absMigrationsPath = path.resolve(rootDir, migrationsPath);
  const absModelsPath = path.resolve(rootDir, modelsPath);
  const absArtisanPath = path.resolve(rootDir, artisanPath);

  ensureDirectory(absMigrationsPath, rootDir, created, skipped);
  ensureDatabaseFile(absDbPath, rootDir, force, created, skipped);
  ensureDirectory(absModelsPath, rootDir, created, skipped);

  writeFileWithMode(
    absArtisanPath,
    renderArtisanTemplate({ dbPath, migrationsPath, modelsPath }),
    rootDir,
    force,
    created,
    skipped,
  );

  if (createExampleModel) {
    const modelPath = path.join(absModelsPath, `${exampleModelName}.ts`);
    writeFileWithMode(
      modelPath,
      renderModelTemplate(exampleModelName),
      rootDir,
      force,
      created,
      skipped,
    );
  }

  return { created, skipped };
}

function ensureDirectory(dirPath: string, rootDir: string, created: string[], skipped: string[]): void {
  if (fs.existsSync(dirPath)) {
    skipped.push(toRelative(dirPath, rootDir));
    return;
  }
  fs.mkdirSync(dirPath, { recursive: true });
  created.push(toRelative(dirPath, rootDir));
}

function ensureDatabaseFile(
  dbPath: string,
  rootDir: string,
  force: boolean,
  created: string[],
  skipped: string[],
): void {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (fs.existsSync(dbPath) && !force) {
    skipped.push(toRelative(dbPath, rootDir));
    return;
  }
  fs.writeFileSync(dbPath, '');
  created.push(toRelative(dbPath, rootDir));
}

function writeFileWithMode(
  filePath: string,
  content: string,
  rootDir: string,
  force: boolean,
  created: string[],
  skipped: string[],
): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath) && !force) {
    skipped.push(toRelative(filePath, rootDir));
    return;
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  created.push(toRelative(filePath, rootDir));
}

function renderArtisanTemplate(paths: { dbPath: string; migrationsPath: string; modelsPath: string }): string {
  const dbPath = normalizeScriptPath(paths.dbPath);
  const migrationsPath = normalizeScriptPath(paths.migrationsPath);
  const modelsPath = normalizeScriptPath(paths.modelsPath);

  return `import { Artisan } from '@2byte/artisan';
import { Database } from 'bun:sqlite';
import { ArtisanMakeModelPlugin, ArtisanMigrationPlugin, Migration } from '@2byte/bun-sqlite-model';

const artisan = new Artisan();
const db = new Database('${dbPath}');

artisan
  .register(new ArtisanMigrationPlugin(new Migration(db, '${migrationsPath}')))
  .register(new ArtisanMakeModelPlugin({ modelsPath: '${modelsPath}' }));

await artisan.run();
`;
}

function renderModelTemplate(className: string): string {
  const tableName = toTableName(className);
  return `import { Model } from '@2byte/bun-sqlite-model';

export class ${className} extends Model {
  protected static override tableName = '${tableName}';
}
`;
}

function toTableName(className: string): string {
  const snake = className.replace(/([A-Z])/g, (match, letter, offset) => {
    return offset === 0 ? letter.toLowerCase() : '_' + letter.toLowerCase();
  });

  if (snake.endsWith('y') && !/[aeiou]y$/.test(snake)) return snake.slice(0, -1) + 'ies';
  if (/(?:s|x|z|ch|sh)$/.test(snake)) return snake + 'es';
  return snake + 's';
}

function toRelative(targetPath: string, rootDir: string): string {
  const relativePath = path.relative(rootDir, targetPath).replace(/\\/g, '/');
  return relativePath || '.';
}

function normalizeScriptPath(value: string): string {
  const posix = value.replace(/\\/g, '/');
  if (posix.startsWith('./') || posix.startsWith('../')) return posix;
  return `./${posix}`;
}

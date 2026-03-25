import type { ArtisanCommand, ArtisanPlugin } from '@2byte/artisan';
import { Migration } from './Migration.ts';
import fs from 'fs';
import path from 'path';

interface MigrationPluginOptions {
  /** Path for the dump output file. Default: ./dump.sql */
  outputPath?: string;
}

export class ArtisanMigrationPlugin implements ArtisanPlugin {
  private migration: Migration;
  private outputPath: string;

  constructor(migration: Migration, options: MigrationPluginOptions = {}) {
    this.migration = migration;
    this.outputPath = options.outputPath ?? './dump.sql';
  }

  commands(): ArtisanCommand[] {
    return [
      {
        name: 'up',
        description: 'Run all pending migrations',
        handler: () => this.migration.up(),
      },
      {
        name: 'down',
        description: 'Roll back the entire last batch of migrations',
        handler: () => this.migration.down(),
      },
      {
        name: 'rollback',
        description: 'Roll back N steps (default: 1)',
        handler: (args) => {
          const steps = args[0] && !args[0].startsWith('-') ? parseInt(args[0], 10) : 1;
          this.migration.down(steps);
        },
      },
      {
        name: 'status',
        description: 'Show migration status',
        handler: () => this.migration.status(),
      },
      {
        name: 'dump',
        description: 'Export DB schema to SQL file. Add --data for full dump with INSERT statements',
        handler: (args) => this.dump(args),
      },
      {
        name: 'make:migration',
        description: 'Create a new migration file: make:migration <name>',
        handler: (args) => {
          const name = args[0];
          if (!name) {
            console.error('Usage: make:migration <name>');
            process.exit(1);
          }
          Migration.create(name, this.migration.getMigrationsPath());
        },
      },
    ];
  }

  private dump(args: string[]): void {
    const withData = args.includes('--data');
    const db = this.migration.getDatabase();

    const schemaRows = db.query(
      `SELECT type, name, sql FROM sqlite_master
       WHERE type IN ('table', 'index', 'view', 'trigger')
         AND sql NOT NULL
         AND name != 'sqlite_sequence'
       ORDER BY type, name`
    ).all() as { type: string; name: string; sql: string }[];

    let output = `-- Schema dump\n-- Generated: ${new Date().toISOString()}\n`;
    if (withData) output += '-- Includes: schema + data\n';
    output += '\n';

    for (const row of schemaRows) {
      output += `-- ${row.type}: ${row.name}\n${row.sql};\n\n`;
    }

    if (withData) {
      const tables = schemaRows.filter(r => r.type === 'table');
      for (const table of tables) {
        const dataRows = db.query(`SELECT * FROM "${table.name}"`).all() as Record<string, unknown>[];
        if (dataRows.length === 0) continue;

        output += `-- Data for: ${table.name}\n`;
        for (const row of dataRows) {
          const cols = Object.keys(row).map(c => `"${c}"`).join(', ');
          const vals = Object.values(row).map(v => {
            if (v === null) return 'NULL';
            if (typeof v === 'number') return String(v);
            return `'${String(v).replace(/'/g, "''")}'`;
          }).join(', ');
          output += `INSERT INTO "${table.name}" (${cols}) VALUES (${vals});\n`;
        }
        output += '\n';
      }
    }

    const outPath = path.resolve(this.outputPath);
    fs.writeFileSync(outPath, output, 'utf-8');
    console.log(`✅ Dumped to: ${outPath}${withData ? ' (schema + data)' : ' (schema only)'}`);
  }
}

import { Database } from 'bun:sqlite';
import fs from 'fs';
import path from 'path';

export interface MigrationFile {
  id: number;
  name: string;
  path: string;
}

export interface MigrationRecord {
  id: number;
  name: string;
  batch: number;
  created_at: string;
}

export class Migration {
  private db: Database;
  private migrationsPath: string;

  constructor(db: Database, migrationsPath: string) {
    this.db = db;
    this.migrationsPath = migrationsPath;
    this.initMigrationsTable();
  }

  getDatabase(): Database {
    return this.db;
  }

  getMigrationsPath(): string {
    return this.migrationsPath;
  }

  private initMigrationsTable(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        batch INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private getMigrationFiles(): MigrationFile[] {
    return fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .map(file => {
        const [id, ...nameParts] = file.replace('.sql', '').split('_');
        return {
          id: parseInt(id),
          name: nameParts.join('_'),
          path: path.join(this.migrationsPath, file),
        };
      })
      .sort((a, b) => a.id - b.id);
  }

  private getExecutedMigrations(): string[] {
    return (this.db.query('SELECT name FROM migrations').all() as { name: string }[])
      .map(row => row.name);
  }

  private getLastBatch(): number {
    const row = this.db.query('SELECT MAX(batch) as max_batch FROM migrations').get() as { max_batch: number | null };
    return row.max_batch ?? 0;
  }

  /**
   * Extracts the SQL block for a given section (UP or DOWN) from a migration file.
   * Sections are delimited by `-- UP` and `-- DOWN` markers.
   */
  private extractSection(sql: string, section: 'UP' | 'DOWN'): string | null {
    const regex = new RegExp(`--\\s*${section}\\s*\\n([\\s\\S]*?)(?=--\\s*(?:UP|DOWN)|$)`, 'i');
    const match = sql.match(regex);
    return match ? match[1].trim() : null;
  }

  /**
   * Runs all pending migrations in order.
   */
  up(): void {
    const executed = this.getExecutedMigrations();
    const pending = this.getMigrationFiles().filter(f => !executed.includes(f.name));

    if (pending.length === 0) {
      console.log('Nothing to migrate.');
      return;
    }

    const batch = this.getLastBatch() + 1;

    for (const file of pending) {
      const content = fs.readFileSync(file.path, 'utf-8');
      const upSql = this.extractSection(content, 'UP');

      if (!upSql) {
        throw new Error(`Migration ${file.name}: -- UP section not found.`);
      }

      try {
        this.db.transaction(() => {
          // db.exec() handles multiple SQL statements in one call
          this.db.exec(upSql);
          this.db.query('INSERT INTO migrations (name, batch) VALUES (?, ?)').run(file.name, batch);
        })();
        console.log(`✅ Migrated:     ${file.id}_${file.name}`);
      } catch (error) {
        console.error(`❌ Failed:       ${file.id}_${file.name}`, error);
        throw error;
      }
    }
  }

  /**
   * Rolls back migrations from the last batch.
   * @param steps - number of migrations to roll back (default: all in last batch)
   */
  down(steps?: number): void {
    const batch = this.getLastBatch();
    if (batch === 0) {
      console.log('Nothing to rollback.');
      return;
    }

    let records = this.db.query(
      'SELECT * FROM migrations WHERE batch = ? ORDER BY id DESC'
    ).all(batch) as MigrationRecord[];

    if (steps !== undefined) {
      records = records.slice(0, steps);
    }

    for (const record of records) {
      const file = this.getMigrationFiles().find(f => f.name === record.name);
      if (!file) {
        console.warn(`⚠️  File not found for migration: ${record.name}`);
        continue;
      }

      const content = fs.readFileSync(file.path, 'utf-8');
      const downSql = this.extractSection(content, 'DOWN');

      if (!downSql) {
        console.warn(`⚠️  No -- DOWN section in: ${file.name}`);
        continue;
      }

      try {
        this.db.transaction(() => {
          this.db.run(downSql);
          this.db.query('DELETE FROM migrations WHERE name = ?').run(record.name);
        })();
        console.log(`✅ Rolled back:  ${file.id}_${file.name}`);
      } catch (error) {
        console.error(`❌ Failed rollback: ${file.id}_${file.name}`, error);
        throw error;
      }
    }
  }

  /**
   * Prints the status of all migrations.
   */
  status(): void {
    const executed = this.getExecutedMigrations();
    const files = this.getMigrationFiles();

    console.log('\nMigration status:\n');
    for (const file of files) {
      const icon = executed.includes(file.name) ? '✅' : '⏳';
      console.log(`  ${icon} ${file.id}_${file.name}`);
    }
    console.log();
  }

  /**
   * Scaffolds a new migration file.
   * @param name - migration name, e.g. "create_users"
   * @param migrationsPath - directory where .sql files live
   */
  static create(name: string, migrationsPath: string): void {
    const existingIds = fs.readdirSync(migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .map(file => parseInt(file.split('_')[0]));

    const nextId = (Math.max(0, ...existingIds) + 1).toString().padStart(3, '0');
    const fileName = `${nextId}_${name}.sql`;
    const filePath = path.join(migrationsPath, fileName);

    const template = `-- UP
CREATE TABLE IF NOT EXISTS ${name} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- DOWN
DROP TABLE IF EXISTS ${name};
`;

    fs.writeFileSync(filePath, template);
    console.log(`✅ Created: ${fileName}`);
  }
}

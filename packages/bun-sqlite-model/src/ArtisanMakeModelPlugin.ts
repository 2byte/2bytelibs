import type { ArtisanCommand, ArtisanPlugin } from '@2byte/artisan';
import fs from 'fs';
import path from 'path';

interface MakeModelPluginOptions {
  /** Directory where model files will be created */
  modelsPath: string;
  /** Import statement for the base class. Default: import { Model } from '@2byte/bun-sqlite-model'; */
  baseImport?: string;
  /** Name of the base class to extend. Default: Model */
  baseClass?: string;
}

export class ArtisanMakeModelPlugin implements ArtisanPlugin {
  private modelsPath: string;
  private baseImport: string;
  private baseClass: string;

  constructor(options: MakeModelPluginOptions) {
    this.modelsPath = options.modelsPath;
    this.baseImport = options.baseImport ?? "import { Model } from '@2byte/bun-sqlite-model';";
    this.baseClass = options.baseClass ?? 'Model';
  }

  commands(): ArtisanCommand[] {
    return [
      {
        name: 'make:model',
        description: 'Create a new model file: make:model <ClassName>',
        handler: (args) => this.makeModel(args),
      },
    ];
  }

  private makeModel(args: string[]): void {
    const className = args[0];
    if (!className) {
      console.error('Usage: make:model <ClassName>');
      process.exit(1);
    }

    if (!/^[A-Z][A-Za-z0-9]*$/.test(className)) {
      console.error('Class name must be in PascalCase (e.g. UserProfile)');
      process.exit(1);
    }

    const tableName = this.toTableName(className);
    const filePath = path.join(this.modelsPath, `${className}.ts`);

    if (fs.existsSync(filePath)) {
      console.error(`❌ Model already exists: ${filePath}`);
      process.exit(1);
    }

    fs.mkdirSync(this.modelsPath, { recursive: true });

    const content =
`${this.baseImport}

export class ${className} extends ${this.baseClass} {
  protected static override tableName = '${tableName}';
}
`;

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✅ Created: ${filePath}`);
  }

  /** Converts PascalCase class name to snake_case plural table name. */
  private toTableName(className: string): string {
    const snake = className
      .replace(/([A-Z])/g, (match, letter, offset) =>
        offset === 0 ? letter.toLowerCase() : '_' + letter.toLowerCase()
      );

    if (snake.endsWith('y') && !/[aeiou]y$/.test(snake)) {
      return snake.slice(0, -1) + 'ies';
    }
    if (/(?:s|x|z|ch|sh)$/.test(snake)) {
      return snake + 'es';
    }
    return snake + 's';
  }
}

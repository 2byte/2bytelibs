#!/usr/bin/env bun

import { initProject } from './initProject.ts';

interface CliOptions {
  rootDir?: string;
  dbPath?: string;
  migrationsPath?: string;
  modelsPath?: string;
  artisanPath?: string;
  createExampleModel?: boolean;
  exampleModelName?: string;
  force?: boolean;
}

async function main(argv: string[]): Promise<void> {
  const command = argv[2];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command !== 'init') {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }

  const parsed = parseOptions(argv.slice(3));
  if (parsed.help) {
    printHelp();
    return;
  }

  const result = initProject(parsed.options);
  for (const item of result.created) {
    console.log(`created: ${item}`);
  }
  for (const item of result.skipped) {
    console.log(`skipped: ${item}`);
  }
}

function parseOptions(args: string[]): { options: CliOptions; help: boolean } {
  const options: CliOptions = {};
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }

    if (arg === '--force') {
      options.force = true;
      continue;
    }

    if (arg === '--no-example-model') {
      options.createExampleModel = false;
      continue;
    }

    if (arg.startsWith('--root=')) {
      options.rootDir = readInlineValue(arg, '--root=');
      continue;
    }
    if (arg === '--root') {
      options.rootDir = readNextValue(args, ++i, '--root');
      continue;
    }

    if (arg.startsWith('--db=')) {
      options.dbPath = readInlineValue(arg, '--db=');
      continue;
    }
    if (arg === '--db') {
      options.dbPath = readNextValue(args, ++i, '--db');
      continue;
    }

    if (arg.startsWith('--migrations=')) {
      options.migrationsPath = readInlineValue(arg, '--migrations=');
      continue;
    }
    if (arg === '--migrations') {
      options.migrationsPath = readNextValue(args, ++i, '--migrations');
      continue;
    }

    if (arg.startsWith('--models=')) {
      options.modelsPath = readInlineValue(arg, '--models=');
      continue;
    }
    if (arg === '--models') {
      options.modelsPath = readNextValue(args, ++i, '--models');
      continue;
    }

    if (arg.startsWith('--artisan=')) {
      options.artisanPath = readInlineValue(arg, '--artisan=');
      continue;
    }
    if (arg === '--artisan') {
      options.artisanPath = readNextValue(args, ++i, '--artisan');
      continue;
    }

    if (arg.startsWith('--example-model=')) {
      options.exampleModelName = readInlineValue(arg, '--example-model=');
      continue;
    }
    if (arg === '--example-model') {
      options.exampleModelName = readNextValue(args, ++i, '--example-model');
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return { options, help };
}

function readInlineValue(value: string, prefix: string): string {
  const output = value.slice(prefix.length).trim();
  if (!output) throw new Error(`Expected a value for ${prefix.slice(0, -1)}`);
  return output;
}

function readNextValue(args: string[], index: number, flagName: string): string {
  const value = args[index];
  if (!value || value.startsWith('-')) {
    throw new Error(`Expected a value after ${flagName}`);
  }
  return value;
}

function printHelp(): void {
  console.log(`
@2byte/artisan CLI

Usage:
  2byte-artisan init [options]

Options:
  --root <path>             Project root directory (default: current directory)
  --db <path>               SQLite file path (default: ./database/db.sqlite3)
  --migrations <path>       Migrations directory (default: ./database/migrations)
  --models <path>           Models directory (default: ./models)
  --artisan <path>          Output artisan entry file (default: ./artisan.ts)
  --example-model <name>    Example model class name (default: Example)
  --no-example-model        Do not create models/Example.ts
  --force                   Overwrite existing files
  -h, --help                Show this help
`);
}

main(process.argv).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});

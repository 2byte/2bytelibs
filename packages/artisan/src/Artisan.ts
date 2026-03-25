export interface ArtisanCommand {
  name: string;
  description?: string;
  handler(args: string[]): void | Promise<void>;
}

export interface ArtisanPlugin {
  commands(): ArtisanCommand[];
}

export class Artisan {
  private registry: Map<string, ArtisanCommand> = new Map();

  /**
   * Registers all commands from a plugin.
   * If prefix is provided, all command names will be prefixed with `prefix:`.
   */
  register(plugin: ArtisanPlugin, prefix?: string): this {
    for (const cmd of plugin.commands()) {
      const name = prefix ? `${prefix}:${cmd.name}` : cmd.name;
      this.registry.set(name, { ...cmd, name });
    }
    return this;
  }

  /**
   * Registers a single command directly.
   */
  command(name: string, handler: (args: string[]) => void | Promise<void>, options?: { description?: string }): this {
    this.registry.set(name, { name, handler, description: options?.description });
    return this;
  }

  printHelp(): void {
    console.log('\nAvailable commands:\n');
    const maxLen = Math.max(...[...this.registry.keys()].map(k => k.length));
    for (const [name, cmd] of this.registry) {
      const pad = ' '.repeat(maxLen - name.length + 2);
      const desc = cmd.description ? `${pad}${cmd.description}` : '';
      console.log(`  ${name}${desc}`);
    }
    console.log();
  }

  async run(argv: string[] = process.argv): Promise<void> {
    const commandName = argv[2];
    const args = argv.slice(3);

    if (!commandName || commandName === 'help') {
      this.printHelp();
      return;
    }

    const cmd = this.registry.get(commandName);
    if (!cmd) {
      console.error(`\nUnknown command: "${commandName}"\n`);
      this.printHelp();
      process.exit(1);
    }

    await cmd.handler(args);
  }
}
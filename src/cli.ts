#!/usr/bin/env bun
import {connect} from './db/client.ts';
import {parseFlags, usage} from './cli/args.ts';
import {EXIT, writeError, type Command} from './cli/command.ts';
import {COMMANDS, findCommand} from './cli/registry.ts';

/**
 * `pr-example <command> [flags]`.
 *
 * Same shape as every toryo CLI, on purpose: one JSON document on stdout,
 * human text on stderr, and the same exit codes. An agent that can drive
 * `toryo-memory` can drive this without being told anything new.
 */
async function main(argv: string[]): Promise<number> {
  const [name, ...rest] = argv;

  if (!name || name === '--help' || name === '-h' || name === 'help') {
    printUsage();
    return EXIT.success;
  }

  const command = findCommand(name);
  if (!command) {
    writeError(`unknown command '${name}'\n`);
    printUsage();
    return EXIT.badArgs;
  }

  if (rest.includes('--help') || rest.includes('-h')) {
    printCommandUsage(command);
    return EXIT.success;
  }

  const parsed = parseFlags(rest, command.flags);
  if (!parsed.ok) {
    writeError(`${command.name}: ${parsed.message}`);
    return EXIT.badArgs;
  }

  try {
    const db = connect();
    return await command.run({db, flags: parsed.flags, positionals: parsed.positionals});
  } catch (error) {
    // Never swallow it: the cause is almost always a schema or file-permission
    // problem, and the original message is the only thing that identifies which.
    writeError(`${command.name}: ${(error as Error).message}`);
    return EXIT.dbError;
  }
}

function printUsage(): void {
  const lines = COMMANDS.map((c) => `  ${c.name.padEnd(10)}${c.describe}`).join('\n');
  process.stdout.write(`pr-example <command> [flags]\n\nCommands:\n${lines}\n\nRun a command with --help for its flags.\n`);
}

function printCommandUsage(command: Command): void {
  const flags = command.flags.length > 0 ? `\n\nFlags:\n${usage(command.flags)}` : '';
  process.stdout.write(`pr-example ${command.name} — ${command.describe}${flags}\n`);
}

process.exit(await main(process.argv.slice(2)));

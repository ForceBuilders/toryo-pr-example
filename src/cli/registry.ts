import {getCommand} from './commands/get.ts';
import {ingestCommand} from './commands/ingest.ts';
import {listCommand} from './commands/list.ts';
import {migrateCommand} from './commands/migrate.ts';
import {postCommand} from './commands/post.ts';
import {recordCommand} from './commands/record.ts';
import type {Command} from './command.ts';

/**
 * The command surface, as data. Dispatch is a lookup, not a `switch`, so a new
 * command is a new file plus one line here.
 */
export const COMMANDS: ReadonlyArray<Command> = [
  recordCommand,
  ingestCommand,
  listCommand,
  getCommand,
  postCommand,
  migrateCommand,
];

export function findCommand(name: string): Command | undefined {
  return COMMANDS.find((c) => c.name === name);
}

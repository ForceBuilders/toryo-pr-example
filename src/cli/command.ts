import type {Db} from '../db/client.ts';
import type {FlagSpec, FlagValues} from './args.ts';

/**
 * Exit codes, copied from toryo's contract rather than invented.
 *
 * An agent or script driving this CLI already knows what 67 means from every
 * other toryo command it calls. Picking different numbers because this is a
 * different program would be a small, gratuitous incompatibility.
 */
export const EXIT = {
  success: 0,
  generalError: 1,
  badArgs: 64,
  dbError: 65,
  notFound: 67,
} as const;

/**
 * One command as a standalone data object. The registry is an array of these,
 * so adding a command is adding a file and one import, never editing a
 * `switch` that grows a case per verb.
 */
export type Command = {
  name: string;
  describe: string;
  flags: readonly FlagSpec[];
  run: (ctx: {db: Db; flags: FlagValues; positionals: string[]}) => Promise<number> | number;
};

/**
 * Emit exactly one JSON document on stdout, single line, trailing newline.
 *
 * The convention every toryo read command follows, and the reason a consumer
 * can parse the LAST non-empty line and be confident about what it got. Human
 * chatter goes to stderr so it never lands in the middle of a payload.
 */
export function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

export function writeError(message: string): void {
  process.stderr.write(`${message}\n`);
}

import {record} from '../../record.ts';
import {roundArtifactSchema} from '../../types.ts';
import {EXIT, writeError, writeJson, type Command} from '../command.ts';
import {str} from '../args.ts';

/**
 * Record a round from an artifact file.
 *
 * The manual path, and the one to reach for when the sequence produced a good
 * `findings.json` but the run row is gone, or when you want to try the store
 * without running an agent at all.
 */
export const recordCommand: Command = {
  name: 'record',
  describe: 'record a review round from a findings.json file',
  flags: [
    {name: 'file', short: 'f', takesValue: true, required: true, describe: 'path to a findings.json artifact'},
    {name: 'project', short: 'p', takesValue: true, describe: 'toryo project id to attribute the round to'},
  ],
  async run({db, flags}) {
    const path = str(flags, 'file')!;
    const file = Bun.file(path);
    if (!(await file.exists())) {
      writeError(`record: no such file: ${path}`);
      return EXIT.notFound;
    }

    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch (error) {
      writeError(`record: ${path} is not valid JSON: ${(error as Error).message}`);
      return EXIT.badArgs;
    }

    const parsed = roundArtifactSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      writeError(`record: ${path} does not match the artifact schema: ${first?.path.join('.')} ${first?.message}`);
      return EXIT.badArgs;
    }

    const result = record(db, {...parsed.data, projectId: str(flags, 'project') ?? null});
    writeJson(result);
    return EXIT.success;
  },
};

import {ingestRun} from '../../ingest.ts';
import {EXIT, writeError, writeJson, type Command} from '../command.ts';
import {str} from '../args.ts';

/**
 * Pull a finished sequence run's artifact into the store.
 *
 * The server does this automatically while it is watching a run. This command
 * is the answer to "the server was not running when the review finished": the
 * artifact is still on disk, so nothing is lost.
 */
export const ingestCommand: Command = {
  name: 'ingest',
  describe: "read a finished run's findings.json and record it",
  flags: [{name: 'run', short: 'r', takesValue: true, required: true, describe: 'toryo sequence run id'}],
  async run({db, flags}) {
    const outcome = await ingestRun(db, str(flags, 'run')!);

    if (outcome.kind === 'pending') {
      writeError(`ingest: run is still ${outcome.status}${outcome.currentStep ? ` at '${outcome.currentStep}'` : ''}`);
      return EXIT.generalError;
    }
    if (outcome.kind === 'failed') {
      writeError(`ingest: ${outcome.message}`);
      return EXIT.generalError;
    }

    writeJson({repo: outcome.repo, pr: outcome.pr, ...outcome.result});
    return EXIT.success;
  },
};

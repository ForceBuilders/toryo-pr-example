import {getTargetByPr} from '../../queries.ts';
import {postFindings} from '../../triage.ts';
import {EXIT, writeError, writeJson, type Command} from '../command.ts';
import {int, list, str} from '../args.ts';

/**
 * Post to GitHub from the terminal.
 *
 * With no `--finding-id`, this posts everything still `pending`: the "I read
 * it in the UI and I agree with all of it" path.
 */
export const postCommand: Command = {
  name: 'post',
  describe: 'post findings to the pull request as one review',
  flags: [
    {name: 'repo', short: 'r', takesValue: true, required: true, describe: 'owner/name'},
    {name: 'pr', takesValue: true, required: true, describe: 'pull request number'},
    {
      name: 'finding-id',
      takesValue: true,
      multiple: true,
      describe: 'finding row id; repeatable. Omit to post everything pending',
    },
  ],
  async run({db, flags}) {
    const pr = int(flags, 'pr');
    if (pr === undefined) {
      writeError('post: --pr must be a positive integer');
      return EXIT.badArgs;
    }

    const repo = str(flags, 'repo')!;
    const target = getTargetByPr(db, repo, pr);
    if (!target) {
      writeError(`post: no review recorded for ${repo}#${pr}`);
      return EXIT.notFound;
    }

    const result = await postFindings(db, target.id, list(flags, 'finding-id'));
    if (!result.ok) {
      writeError(`post: ${result.message}`);
      return EXIT.generalError;
    }

    writeJson(result.value);
    return EXIT.success;
  },
};

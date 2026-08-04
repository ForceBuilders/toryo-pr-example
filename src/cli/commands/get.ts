import {getTargetByPr, getTargetDetail} from '../../queries.ts';
import {EXIT, writeError, writeJson, type Command} from '../command.ts';
import {bool, int, str} from '../args.ts';

export const getCommand: Command = {
  name: 'get',
  describe: 'show one pull request with its rounds and findings',
  flags: [
    {name: 'repo', short: 'r', takesValue: true, required: true, describe: 'owner/name'},
    {name: 'pr', takesValue: true, required: true, describe: 'pull request number'},
    {name: 'all', takesValue: false, describe: 'include findings already addressed'},
  ],
  run({db, flags}) {
    const pr = int(flags, 'pr');
    if (pr === undefined) {
      writeError('get: --pr must be a positive integer');
      return EXIT.badArgs;
    }

    const repo = str(flags, 'repo')!;
    const target = getTargetByPr(db, repo, pr);
    if (!target) {
      writeError(`get: no review recorded for ${repo}#${pr}`);
      return EXIT.notFound;
    }

    writeJson(getTargetDetail(db, target.id, {includeAddressed: bool(flags, 'all')}));
    return EXIT.success;
  },
};

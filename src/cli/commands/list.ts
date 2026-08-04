import {listTargets} from '../../queries.ts';
import {EXIT, writeJson, type Command} from '../command.ts';

export const listCommand: Command = {
  name: 'list',
  describe: 'list every reviewed pull request',
  flags: [],
  run({db}) {
    writeJson(listTargets(db));
    return EXIT.success;
  },
};

import {dbPath} from '../../db/client.ts';
import {EXIT, writeJson, type Command} from '../command.ts';

/**
 * Bring the database up to date.
 *
 * Every command already migrates on connect, so this exists to give setup an
 * explicit step that reports where the file landed. "It worked and here is
 * where it is" beats a silent success.
 */
export const migrateCommand: Command = {
  name: 'migrate',
  describe: 'create or update the database',
  flags: [],
  run() {
    writeJson({migrated: true, database: dbPath()});
    return EXIT.success;
  },
};

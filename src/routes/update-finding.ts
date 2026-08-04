import {dispose, editBody} from '../triage.ts';
import {DISPOSITIONS, type Disposition} from '../types.ts';
import {fail, json, readJson, type Route} from './route.ts';

type Body = {body?: string | null; disposition?: string};

/**
 * Edit a finding's text, set its disposition, or both.
 *
 * Both are operator state, and neither is ever overwritten by a later review
 * round. See `src/triage.ts` for why the edit lives in its own column.
 */
export const updateFindingRoute: Route = {
  method: 'PATCH',
  path: '/api/findings/:id',
  async handler(req, params, ctx) {
    const body = await readJson<Body>(req);
    if (!body) return fail('expected a JSON body', 400);

    const id = params.id!;
    let current = null;

    if (body.body !== undefined) {
      const edited = editBody(ctx.db, id, body.body);
      if (!edited.ok) return fail(edited.message, 404);
      current = edited.value;
    }

    if (body.disposition !== undefined) {
      if (!(DISPOSITIONS as readonly string[]).includes(body.disposition)) {
        return fail(`disposition must be one of: ${DISPOSITIONS.join(', ')}`, 400);
      }
      const disposed = dispose(ctx.db, id, body.disposition as Disposition);
      if (!disposed.ok) return fail(disposed.message, 404);
      current = disposed.value;
    }

    if (!current) return fail('nothing to update: pass body, disposition, or both', 400);
    return json(current);
  },
};

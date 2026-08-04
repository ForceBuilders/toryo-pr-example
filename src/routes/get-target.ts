import {getTargetDetail} from '../queries.ts';
import {fail, json, type Route} from './route.ts';

export const getTargetRoute: Route = {
  method: 'GET',
  path: '/api/targets/:id',
  handler(req, params, ctx) {
    const includeAddressed = new URL(req.url).searchParams.get('all') === '1';
    const detail = getTargetDetail(ctx.db, params.id!, {includeAddressed});
    return detail ? json(detail) : fail(`no target ${params.id}`, 404);
  },
};

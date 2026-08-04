import {listTargets} from '../queries.ts';
import {json, type Route} from './route.ts';

export const listTargetsRoute: Route = {
  method: 'GET',
  path: '/api/targets',
  handler(_req, _params, ctx) {
    return json(listTargets(ctx.db));
  },
};

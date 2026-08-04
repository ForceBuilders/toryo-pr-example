import {getRunRoute} from './get-run.ts';
import {getTargetRoute} from './get-target.ts';
import {listTargetsRoute} from './list-targets.ts';
import {postFindingRoute} from './post-finding.ts';
import {postTargetRoute} from './post-target.ts';
import {startReviewRoute} from './start-review.ts';
import {updateFindingRoute} from './update-finding.ts';
import type {Route, RouteContext} from './route.ts';

export const ROUTES: ReadonlyArray<Route> = [
  listTargetsRoute,
  getTargetRoute,
  postTargetRoute,
  startReviewRoute,
  getRunRoute,
  updateFindingRoute,
  postFindingRoute,
];

type BunRouteHandler = (req: Request & {params: Record<string, string>}) => Response | Promise<Response>;

/**
 * Fold the route list into the shape `Bun.serve` wants: path → {METHOD: handler}.
 *
 * The registry stays a flat array because that is what reads well and what
 * tests iterate; this is the one adapter that knows Bun's shape.
 */
export function toBunRoutes(ctx: RouteContext): Record<string, Record<string, BunRouteHandler>> {
  const out: Record<string, Record<string, BunRouteHandler>> = {};
  for (const route of ROUTES) {
    const byMethod = (out[route.path] ??= {});
    byMethod[route.method] = function (req) {
      return route.handler(req, req.params, ctx);
    };
  }
  return out;
}

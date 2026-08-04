import type {Db} from '../db/client.ts';

/**
 * A route as a standalone data object, mirroring how commands are defined in
 * `src/cli/`. Two surfaces over the same functions in `src/`, neither of them
 * owning any logic.
 */
export type RouteContext = {
  db: Db;
  /**
   * Runs already pulled into the store, so two overlapping polls of the same
   * finished run cannot record it twice. In-memory on purpose: losing it on
   * restart costs at worst one duplicate round, and the alternative (a table)
   * is state to migrate for a problem a `Set` solves.
   */
  ingested: Map<string, Promise<unknown>>;
};

export type RouteHandler = (
  req: Request,
  params: Record<string, string>,
  ctx: RouteContext,
) => Response | Promise<Response>;

export type Route = {
  method: 'GET' | 'POST' | 'PATCH';
  /** A Bun.serve route pattern, e.g. `/api/targets/:id`. */
  path: string;
  handler: RouteHandler;
};

export function json(value: unknown, status = 200): Response {
  return Response.json(value, {status});
}

/**
 * Errors carry the actual reason. A UI that can only say "something went wrong"
 * makes every failure a debugging session.
 */
export function fail(message: string, status: number): Response {
  return Response.json({error: message}, {status});
}

/** Parse a JSON request body, returning null rather than throwing. */
export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

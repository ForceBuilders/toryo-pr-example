import {describe, it, expect, beforeEach} from 'bun:test';
import {ROUTES} from '../src/routes/registry.ts';
import {record} from '../src/record.ts';
import {getTargetByPr, getTargetDetail} from '../src/queries.ts';
import type {Db} from '../src/db/client.ts';
import type {Route, RouteContext} from '../src/routes/route.ts';
import {artifact, finding, testDb} from './helpers/db.ts';

/**
 * The read and edit surface, called directly rather than over a socket. The
 * routes that reach GitHub or toryo are covered by their own units — spinning
 * up a server here would only test Bun's router.
 */

let db: Db;
let ctx: RouteContext;

beforeEach(function () {
  db = testDb();
  ctx = {db, ingested: new Map()};
});

function route(method: string, path: string): Route {
  const found = ROUTES.find((r) => r.method === method && r.path === path);
  if (!found) throw new Error(`no route ${method} ${path}`);
  return found;
}

function call(r: Route, opts: {params?: Record<string, string>; body?: unknown; url?: string} = {}) {
  const req = new Request(`http://localhost${opts.url ?? '/'}`, {
    method: r.method,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return r.handler(req, opts.params ?? {}, ctx);
}

function seed() {
  record(db, artifact({findings: [finding(), finding({title: 'Second', evidence: 'const x = 1;', line: null})]}));
  const target = getTargetByPr(db, 'octo/hello', 42)!;
  const findings = getTargetDetail(db, target.id)!.findings;
  return {target, findings};
}

describe('GET /api/targets', function () {
  it('should return an empty list before anything is reviewed', async function () {
    const res = await call(route('GET', '/api/targets'));

    expect(await res.json()).toEqual([]);
  });

  it('should list a reviewed pull request', async function () {
    seed();

    const res = await call(route('GET', '/api/targets'));

    const body = (await res.json()) as Array<{repo: string; pr: number}>;
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({repo: 'octo/hello', pr: 42});
  });
});

describe('GET /api/targets/:id', function () {
  it('should return the target with its rounds and findings', async function () {
    const {target} = seed();

    const res = await call(route('GET', '/api/targets/:id'), {params: {id: target.id}});

    const body = (await res.json()) as {rounds: unknown[]; findings: unknown[]};
    expect(body.rounds).toHaveLength(1);
    expect(body.findings).toHaveLength(2);
  });

  it('should 404 an unknown target rather than returning an empty shell', async function () {
    const res = await call(route('GET', '/api/targets/:id'), {params: {id: 'nope'}});

    expect(res.status).toBe(404);
  });

  it('should hide addressed findings unless all=1 is passed', async function () {
    const {target} = seed();
    record(db, artifact({findings: []}));

    const hidden = await call(route('GET', '/api/targets/:id'), {params: {id: target.id}, url: '/'});
    const shown = await call(route('GET', '/api/targets/:id'), {params: {id: target.id}, url: '/?all=1'});

    expect((await hidden.json()).findings).toHaveLength(0);
    expect((await shown.json()).findings).toHaveLength(2);
  });
});

describe('PATCH /api/findings/:id', function () {
  it('should store an edited body and report it as effective', async function () {
    const {findings} = seed();

    const res = await call(route('PATCH', '/api/findings/:id'), {
      params: {id: findings[0]!.id},
      body: {body: 'operator wording'},
    });

    const body = (await res.json()) as {body: string; rawBody: string; edited: boolean};
    expect(body.body).toBe('operator wording');
    expect(body.rawBody).not.toBe('operator wording');
    expect(body.edited).toBe(true);
  });

  it('should clear an edit when body is null', async function () {
    const {findings} = seed();
    await call(route('PATCH', '/api/findings/:id'), {params: {id: findings[0]!.id}, body: {body: 'x'}});

    const res = await call(route('PATCH', '/api/findings/:id'), {params: {id: findings[0]!.id}, body: {body: null}});

    expect((await res.json()).edited).toBe(false);
  });

  it('should set a disposition', async function () {
    const {findings} = seed();

    const res = await call(route('PATCH', '/api/findings/:id'), {
      params: {id: findings[0]!.id},
      body: {disposition: 'ignored'},
    });

    expect((await res.json()).disposition).toBe('ignored');
  });

  it('should reject a disposition outside the vocabulary', async function () {
    const {findings} = seed();

    const res = await call(route('PATCH', '/api/findings/:id'), {
      params: {id: findings[0]!.id},
      body: {disposition: 'maybe'},
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('disposition must be one of');
  });

  it('should reject a patch that asks for nothing', async function () {
    const {findings} = seed();

    const res = await call(route('PATCH', '/api/findings/:id'), {params: {id: findings[0]!.id}, body: {}});

    expect(res.status).toBe(400);
  });

  it('should 404 an unknown finding', async function () {
    const res = await call(route('PATCH', '/api/findings/:id'), {params: {id: 'nope'}, body: {disposition: 'ignored'}});

    expect(res.status).toBe(404);
  });

  it('should say what was wrong with an unparseable body', async function () {
    const r = route('PATCH', '/api/findings/:id');
    const req = new Request('http://localhost/', {method: 'PATCH', body: 'not json'});

    const res = await r.handler(req, {id: 'x'}, ctx);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('JSON body');
  });
});

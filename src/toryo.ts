import {homedir} from 'node:os';
import {join} from 'node:path';

/**
 * The toryo boundary. **This whole file is the integration.**
 *
 * toryo's `@toryo/*` packages are private and unpublished, so an external repo
 * cannot import its typed clients. That is by design, not an oversight: toryo's
 * architecture says the CLI *is* the contract, and outside programs talk to it
 * over the process boundary. Which means the integration is about sixty lines
 * of spawn-and-parse — this file — and nothing else in this app knows toryo
 * exists.
 *
 * Two conventions do all the work, both frozen in toryo's `docs/contract.md`:
 *
 *   1. A read command emits exactly one JSON document on stdout. Log lines may
 *      precede it, so you parse the LAST non-empty line, never the first.
 *   2. Exit codes are stable: 0 ok, 64 bad args, 65 db error, 67 not found.
 *      67 is the one worth handling by name.
 */

export type ToryoResult<T> = {ok: true; value: T} | {ok: false; code: number; message: string};

/** How to invoke toryo. The umbrella binary is on PATH after `toryo setup`. */
function toryoBin(): string {
  return process.env.TORYO_BIN ?? 'toryo';
}

/** Where toryo puts a sequence run's artifacts. Mirrors its own convention. */
export function runDir(projectId: string | null, runId: string): string {
  return join(homedir(), '.toryo', 'sequence', projectId ?? '_no-project', runId);
}

export type SequenceRun = {
  id: string;
  sequenceName: string;
  projectId: string | null;
  status: 'blocked' | 'queued' | 'running' | 'paused' | 'succeeded' | 'failed' | 'cancelled';
  currentStep: string | null;
  error?: {message?: string} | null;
};

/** Statuses from which a run will never move again. */
export function isTerminal(status: SequenceRun['status']): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled';
}

/**
 * Start a review. `--input @file` rather than an inline argument: the focus
 * field is free text and shell-quoting it is a bug waiting to happen.
 */
export async function startReview(args: {
  repo: string;
  pr: number;
  focus?: string;
  project: string;
}): Promise<ToryoResult<{runId: string}>> {
  const input: Record<string, unknown> = {repo: args.repo, pr: args.pr};
  if (args.focus) input.focus = args.focus;

  const file = join(homedir(), '.toryo-pr-example', `input-${crypto.randomUUID()}.json`);
  await Bun.write(file, JSON.stringify(input));
  try {
    const r = await toryoJson<{runId?: string; id?: string}>([
      'sequence',
      'run',
      'pr-review',
      '--input',
      `@${file}`,
      '--project',
      args.project,
    ]);
    if (!r.ok) return r;
    const runId = r.value.runId ?? r.value.id;
    if (!runId) return {ok: false, code: 1, message: 'sequence run returned no run id'};
    return {ok: true, value: {runId}};
  } finally {
    await Bun.file(file)
      .delete()
      .catch(function () {});
  }
}

export async function runStatus(runId: string): Promise<ToryoResult<SequenceRun>> {
  return await toryoJson<SequenceRun>(['sequence', 'status', runId]);
}

/** Resolve a directory to the toryo project that owns it. Exit 67 = unregistered. */
export async function resolveProject(dir: string): Promise<ToryoResult<{id: string; slug: string}>> {
  return await toryoJson<{id: string; slug: string}>(['project', 'resolve', dir]);
}

/**
 * Spawn `toryo <args>` and parse the last non-empty stdout line as JSON.
 *
 * Every `@toryo/*-client` package is a typed wrapper around exactly this. When
 * you cannot depend on those packages, reimplementing this is the whole job.
 */
async function toryoJson<T>(args: string[]): Promise<ToryoResult<T>> {
  const proc = Bun.spawn([toryoBin(), ...args], {stdin: 'ignore', stdout: 'pipe', stderr: 'pipe'});
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (code !== 0) {
    const detail = stderr.trim() || stdout.trim() || `exit ${code}`;
    return {ok: false, code, message: `toryo ${args.join(' ')}: ${detail}`};
  }

  const line = stdout
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .at(-1);
  if (!line) return {ok: false, code: 1, message: `toryo ${args.join(' ')}: no output`};

  try {
    return {ok: true, value: JSON.parse(line) as T};
  } catch (error) {
    return {ok: false, code: 1, message: `toryo ${args.join(' ')}: unparseable output: ${(error as Error).message}`};
  }
}

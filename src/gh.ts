import type {FindingView} from './types.ts';

/**
 * The GitHub boundary: the `gh` CLI, always. No token handling, no Octokit, no
 * OAuth app. The operator already ran `gh auth login`, so borrowing that is
 * both less code and one fewer credential to store.
 */

export type GhResult<T> = {ok: true; value: T} | {ok: false; message: string};

/** One comment in a GitHub review submission. */
type ReviewComment = {path: string; line: number; body: string};

/**
 * Post a batch of findings as **one** pull request review.
 *
 * One review, not one comment per finding, and the difference is not cosmetic:
 * ten separate comments send the author ten notification emails and scatter the
 * feedback across the timeline. One review is a single notification and reads
 * as a coherent piece of work.
 *
 * Findings carrying a line number are attached inline to that line; the rest
 * are collected into the review body. GitHub rejects an inline comment on a line
 * that is not part of the diff, so this is a real fallback rather than a
 * theoretical one.
 *
 * The review is always submitted as `COMMENT`. Approving or requesting changes
 * is a human's call, and this example does not let a model make it.
 */
export async function postReview(args: {
  repo: string;
  pr: number;
  findings: FindingView[];
  intro?: string;
}): Promise<GhResult<{posted: number; inline: number}>> {
  if (args.findings.length === 0) return {ok: false, message: 'nothing to post'};

  const inline: ReviewComment[] = [];
  const overflow: FindingView[] = [];
  for (const f of args.findings) {
    if (f.line === null) overflow.push(f);
    else inline.push({path: f.file, line: f.line, body: commentBody(f)});
  }

  const body = [args.intro?.trim(), ...overflow.map(function (f) {
    return `${commentBody(f)}\n\n_${f.file}${f.line === null ? '' : `:${f.line}`}_`;
  })]
    .filter(function (part): part is string {
      return Boolean(part && part.length > 0);
    })
    .join('\n\n---\n\n');

  const payload = {body: body || 'Automated review.', event: 'COMMENT', comments: inline};
  const sent = await ghApiJson(`repos/${args.repo}/pulls/${args.pr}/reviews`, payload);
  if (!sent.ok) return sent;

  return {ok: true, value: {posted: args.findings.length, inline: inline.length}};
}

/**
 * Render one finding for GitHub.
 *
 * The tier prefix is stripped. `T1`/`T2` is internal vocabulary that means
 * nothing to the PR author and reads as a robot talking to itself; severity is
 * conveyed in words instead. Internal taxonomy stays internal.
 */
export function commentBody(f: FindingView): string {
  return `**${severityWord(f.tier)}: ${f.title}**\n\n${f.body}`;
}

function severityWord(tier: FindingView['tier']): string {
  switch (tier) {
    case 'T1':
      return 'Blocking';
    case 'T2':
      return 'Should fix';
    case 'T3':
      return 'Consider';
    case 'T4':
      return 'Nit';
  }
}

/** POST a JSON body to the GitHub API through `gh`, via stdin so nothing is shell-quoted. */
async function ghApiJson(path: string, payload: unknown): Promise<GhResult<unknown>> {
  const proc = Bun.spawn(['gh', 'api', path, '--method', 'POST', '--input', '-'], {
    stdin: new TextEncoder().encode(JSON.stringify(payload)),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) {
    // Preserve what GitHub actually said. "Failed to post" with the body thrown
    // away is the least useful error message there is.
    return {ok: false, message: `gh api ${path} failed (exit ${code}): ${(stderr || stdout).trim()}`};
  }
  try {
    return {ok: true, value: JSON.parse(stdout)};
  } catch {
    return {ok: true, value: null};
  }
}

/** `https://github.com/<repo>/pull/<n>` — the link every row in the UI wants. */
export function prUrl(repo: string, pr: number): string {
  return `https://github.com/${repo}/pull/${pr}`;
}

/** Accepts `owner/name#123`, a full PR URL, or the two parts separately. */
export function parsePrRef(ref: string): {repo: string; pr: number} | null {
  const url = ref.match(/github\.com\/([\w.-]+\/[\w.-]+)\/pull\/(\d+)/);
  if (url) return {repo: url[1]!, pr: Number(url[2])};
  const short = ref.match(/^([\w.-]+\/[\w.-]+)#(\d+)$/);
  if (short) return {repo: short[1]!, pr: Number(short[2])};
  return null;
}

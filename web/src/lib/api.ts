import type {Disposition, FindingView, RoundCounts} from '../../../src/types.ts';

/**
 * The API client.
 *
 * Types are imported straight from `src/types.ts`, the same file the server
 * uses. They are erased at build time, so this costs nothing at runtime and
 * means the wire shape cannot drift between the two halves.
 */

export type TargetRow = {
  id: string;
  repo: string;
  pr: number;
  title: string | null;
  author: string | null;
  baseRef: string | null;
  headRef: string | null;
  latestRound: number;
  latestVerdict: string | null;
  latestSummaryMd: string | null;
  updatedAt: string;
};

export type RoundRow = {
  id: string;
  round: number;
  headSha: string;
  verdict: string;
  summaryMd: string;
  countsJson: string;
  createdAt: string;
};

export type TargetDetail = {
  target: TargetRow;
  rounds: RoundRow[];
  findings: FindingView[];
};

export type RunView = {
  runId: string;
  status: string;
  currentStep: string | null;
  round?: number;
  counts?: RoundCounts;
  target: TargetRow | null;
  error?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body ? {'content-type': 'application/json'} : undefined,
  });
  if (!res.ok) {
    // Surface what the server said. "Request failed" tells the operator nothing
    // they can act on, and the server always sends a reason.
    const detail = await res
      .json()
      .then((b: {error?: string}) => b.error)
      .catch(() => null);
    throw new Error(detail ?? `${init?.method ?? 'GET'} ${path} failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export function fetchTargets(): Promise<TargetRow[]> {
  return request<TargetRow[]>('/api/targets');
}

export function fetchTarget(id: string, includeAddressed: boolean): Promise<TargetDetail> {
  return request<TargetDetail>(`/api/targets/${id}${includeAddressed ? '?all=1' : ''}`);
}

export function fetchRun(runId: string): Promise<RunView> {
  return request<RunView>(`/api/runs/${runId}`);
}

export function startReview(body: {ref: string; focus?: string}): Promise<{runId: string; repo: string; pr: number}> {
  return request('/api/reviews', {method: 'POST', body: JSON.stringify(body)});
}

export function updateFinding(
  id: string,
  patch: {body?: string | null; disposition?: Disposition},
): Promise<FindingView> {
  return request<FindingView>(`/api/findings/${id}`, {method: 'PATCH', body: JSON.stringify(patch)});
}

export function postFinding(id: string): Promise<{posted: number; inline: number}> {
  return request(`/api/findings/${id}/post`, {method: 'POST'});
}

export function postTarget(id: string): Promise<{posted: number; inline: number}> {
  return request(`/api/targets/${id}/post`, {method: 'POST'});
}

export function prUrl(repo: string, pr: number): string {
  return `https://github.com/${repo}/pull/${pr}`;
}

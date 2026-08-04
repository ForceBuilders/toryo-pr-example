import {memo, useCallback, useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import type {Disposition} from '../../../src/types.ts';
import {fetchTarget, postFinding, postTarget, prUrl, updateFinding} from '../lib/api.ts';
import {FindingRow} from '../components/FindingRow.tsx';
import {Markdown} from '../components/Markdown.tsx';
import {VerdictBadge} from '../components/Badges.tsx';

export type TargetDetailProps = {
  targetId: string;
};

export const TargetDetail = memo(function TargetDetail({targetId}: TargetDetailProps) {
  const queryClient = useQueryClient();
  const [includeAddressed, setIncludeAddressed] = useState(false);

  const detail = useQuery({
    queryKey: ['target', targetId, includeAddressed],
    queryFn: function () {
      return fetchTarget(targetId, includeAddressed);
    },
  });

  const invalidate = useCallback(
    function () {
      void queryClient.invalidateQueries({queryKey: ['target', targetId]});
      void queryClient.invalidateQueries({queryKey: ['targets']});
    },
    [queryClient, targetId],
  );

  const patch = useMutation({
    mutationFn: function (args: {id: string; body?: string | null; disposition?: Disposition}) {
      const {id, ...rest} = args;
      return updateFinding(id, rest);
    },
    onSuccess: invalidate,
  });

  const postOne = useMutation({
    mutationFn: function (id: string) {
      return postFinding(id);
    },
    onSuccess: invalidate,
  });

  const postAll = useMutation({
    mutationFn: function () {
      return postTarget(targetId);
    },
    onSuccess: invalidate,
  });

  // Stable identities so FindingRow's memo is worth having.
  const onDispose = useCallback(
    function (id: string, disposition: Disposition) {
      patch.mutate({id, disposition});
    },
    [patch],
  );

  const onSaveBody = useCallback(
    function (id: string, body: string | null) {
      patch.mutate({id, body});
    },
    [patch],
  );

  const onPost = useCallback(
    function (id: string) {
      postOne.mutate(id);
    },
    [postOne],
  );

  if (detail.isPending) return <p className="p-6 text-sm text-neutral-500">Loading…</p>;
  if (detail.isError) return <p className="p-6 text-sm text-red-400">{detail.error.message}</p>;

  const {target, rounds, findings} = detail.data;
  const pending = findings.filter((f) => f.disposition === 'pending').length;
  const busy = patch.isPending || postOne.isPending || postAll.isPending;
  const error = patch.error ?? postOne.error ?? postAll.error;

  return (
    <div className="space-y-4 p-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={prUrl(target.repo, target.pr)}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-sm text-sky-400 underline"
          >
            {target.repo}#{target.pr}
          </a>
          <VerdictBadge verdict={target.latestVerdict} />
          <span className="text-xs text-neutral-500">round {target.latestRound}</span>
        </div>
        <h2 className="text-lg text-neutral-100">{target.title ?? '(untitled)'}</h2>
        <p className="text-xs text-neutral-500">
          {target.author ? `${target.author} · ` : ''}
          {target.headRef} → {target.baseRef}
        </p>
      </header>

      {target.latestSummaryMd && (
        <section className="rounded border border-neutral-800 bg-neutral-900/40 p-3">
          <Markdown>{target.latestSummaryMd}</Markdown>
        </section>
      )}

      {rounds.length > 1 && (
        <section>
          <h3 className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Rounds</h3>
          <ol className="space-y-1">
            {rounds.map(function (round) {
              const counts = safeCounts(round.countsJson);
              return (
                <li key={round.id} className="flex flex-wrap gap-3 text-xs text-neutral-400">
                  <span className="text-neutral-300">#{round.round}</span>
                  <span className="font-mono">{round.headSha.slice(0, 8)}</span>
                  <span>{round.verdict.replace('_', ' ')}</span>
                  <span>
                    {counts.new ?? 0} new · {counts.not_addressed ?? 0} still open · {counts.regressed ?? 0} regressed ·{' '}
                    {counts.addressed ?? 0} fixed
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h3 className="text-xs uppercase tracking-wide text-neutral-500">
            Findings ({findings.length}
            {pending > 0 ? `, ${pending} pending` : ''})
          </h3>
          <label className="flex items-center gap-1 text-xs text-neutral-500">
            <input
              type="checkbox"
              checked={includeAddressed}
              onChange={(e) => setIncludeAddressed(e.target.checked)}
            />
            show fixed
          </label>
          <button
            type="button"
            onClick={() => postAll.mutate()}
            disabled={busy || pending === 0}
            className="rounded bg-sky-800 px-2.5 py-1 text-xs text-sky-100 hover:bg-sky-700 disabled:opacity-40"
          >
            Post {pending} pending as one review
          </button>
        </div>

        {error && <p className="mb-2 text-xs text-red-400">{error.message}</p>}

        {findings.length === 0 ? (
          <p className="text-sm text-neutral-500">Nothing open. Tick "show fixed" for the history.</p>
        ) : (
          <ul className="space-y-2">
            {findings.map(function (finding) {
              return (
                <FindingRow
                  key={finding.id}
                  finding={finding}
                  latestRound={target.latestRound}
                  busy={busy}
                  onDispose={onDispose}
                  onSaveBody={onSaveBody}
                  onPost={onPost}
                />
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
});

function safeCounts(raw: string): Record<string, number> {
  try {
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

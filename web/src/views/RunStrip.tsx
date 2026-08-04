import {memo} from 'react';
import {useQuery} from '@tanstack/react-query';
import {fetchRun} from '../lib/api.ts';

export type RunStripProps = {
  runId: string;
  onFinished: (targetId: string | null) => void;
};

const LIVE_STATUSES = new Set(['blocked', 'queued', 'running', 'paused']);

/**
 * One in-flight review, polled until it finishes.
 *
 * Polling stops when the tab is hidden. A review takes minutes, and a
 * background tab hammering the API for the whole of it costs a `toryo sequence
 * status` subprocess every three seconds for nothing.
 */
export const RunStrip = memo(function RunStrip({runId, onFinished}: RunStripProps) {
  const run = useQuery({
    queryKey: ['run', runId],
    queryFn: function () {
      return fetchRun(runId);
    },
    refetchInterval: function (query) {
      if (document.hidden) return false;
      const status = query.state.data?.status;
      return status && LIVE_STATUSES.has(status) ? 3000 : false;
    },
  });

  const data = run.data;
  const live = data ? LIVE_STATUSES.has(data.status) : true;

  if (data && !live && data.target) {
    // Fires during render on a settled query; React batches it and the parent
    // only reacts to a target id it has not seen.
    queueMicrotask(() => onFinished(data.target?.id ?? null));
  }

  return (
    <div className="flex items-center gap-2 rounded border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-xs">
      <span className={`h-2 w-2 rounded-full ${live ? 'animate-pulse bg-sky-400' : 'bg-neutral-600'}`} />
      <span className="font-mono text-neutral-400">{runId.slice(0, 8)}</span>
      <span className="text-neutral-300">
        {run.isError ? 'unreachable' : (data?.status ?? 'checking…')}
        {data?.currentStep ? ` · ${data.currentStep}` : ''}
      </span>
      {data?.round !== undefined && <span className="text-emerald-400">recorded round {data.round}</span>}
      {data?.error && <span className="text-red-400">{data.error}</span>}
      {run.isError && <span className="text-red-400">{run.error.message}</span>}
    </div>
  );
});

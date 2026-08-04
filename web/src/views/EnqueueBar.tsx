import {memo, useCallback, useState, type SyntheticEvent} from 'react';
import {useMutation} from '@tanstack/react-query';
import {startReview} from '../lib/api.ts';

export type EnqueueBarProps = {
  onStarted: (runId: string) => void;
};

/**
 * Start a review. Accepts `owner/name#123` or a pasted PR URL, because those
 * are the two things anyone actually has in their clipboard.
 */
export const EnqueueBar = memo(function EnqueueBar({onStarted}: EnqueueBarProps) {
  const [ref, setRef] = useState('');
  const [focus, setFocus] = useState('');

  const start = useMutation({
    mutationFn: function () {
      return startReview({ref: ref.trim(), focus: focus.trim() || undefined});
    },
    onSuccess: function (result) {
      setRef('');
      setFocus('');
      onStarted(result.runId);
    },
  });

  const submit = useCallback(
    function (event: SyntheticEvent) {
      event.preventDefault();
      if (ref.trim()) start.mutate();
    },
    [ref, start],
  );

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input
        value={ref}
        onChange={(e) => setRef(e.target.value)}
        placeholder="owner/name#123 or a PR URL"
        className="w-72 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm placeholder:text-neutral-600 focus:border-sky-600 focus:outline-none"
      />
      <input
        value={focus}
        onChange={(e) => setFocus(e.target.value)}
        placeholder="focus (optional)"
        className="w-56 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm placeholder:text-neutral-600 focus:border-sky-600 focus:outline-none"
      />
      <button
        type="submit"
        disabled={!ref.trim() || start.isPending}
        className="rounded bg-sky-800 px-3 py-1 text-sm text-sky-100 transition-colors hover:bg-sky-700 disabled:opacity-40"
      >
        {start.isPending ? 'Starting…' : 'Review'}
      </button>
      {start.isError && <span className="text-xs text-red-400">{start.error.message}</span>}
    </form>
  );
});

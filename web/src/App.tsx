import {useCallback, useState} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {fetchTargets} from './lib/api.ts';
import {EnqueueBar} from './views/EnqueueBar.tsx';
import {RunStrip} from './views/RunStrip.tsx';
import {TargetList} from './views/TargetList.tsx';
import {TargetDetail} from './views/TargetDetail.tsx';

/**
 * One screen: start a review at the top, reviewed PRs down the left, the
 * selected one on the right. No router — at this size a piece of state is
 * clearer than a URL scheme, and the whole app is one page anyway.
 */
export function App() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runIds, setRunIds] = useState<string[]>([]);

  const targets = useQuery({queryKey: ['targets'], queryFn: fetchTargets});

  const onStarted = useCallback(function (runId: string) {
    setRunIds((prev) => (prev.includes(runId) ? prev : [runId, ...prev]));
  }, []);

  const onRunFinished = useCallback(
    function (targetId: string | null) {
      void queryClient.invalidateQueries({queryKey: ['targets']});
      // Jump to the result, but never steal the pane from someone reading
      // another PR while a second review finishes in the background.
      setSelectedId((current) => current ?? targetId);
    },
    [queryClient],
  );

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b border-neutral-800 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-sm font-medium tracking-wide text-neutral-300">
            PR review <span className="text-neutral-600">· built on toryo</span>
          </h1>
          <EnqueueBar onStarted={onStarted} />
        </div>
        {runIds.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {runIds.map(function (runId) {
              return <RunStrip key={runId} runId={runId} onFinished={onRunFinished} />;
            })}
          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-neutral-800">
          {targets.isError ? (
            <p className="p-4 text-sm text-red-400">{targets.error.message}</p>
          ) : (
            <TargetList targets={targets.data ?? []} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">
          {selectedId ? (
            <TargetDetail targetId={selectedId} />
          ) : (
            <p className="p-6 text-sm text-neutral-500">Pick a pull request on the left.</p>
          )}
        </main>
      </div>
    </div>
  );
}

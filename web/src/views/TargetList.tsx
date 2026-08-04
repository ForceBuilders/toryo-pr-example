import {memo} from 'react';
import type {TargetRow} from '../lib/api.ts';
import {VerdictBadge} from '../components/Badges.tsx';

export type TargetListProps = {
  targets: TargetRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export const TargetList = memo(function TargetList({targets, selectedId, onSelect}: TargetListProps) {
  if (targets.length === 0) {
    return (
      <p className="p-4 text-sm text-neutral-500">
        No reviews yet. Paste a pull request above to start one.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-neutral-800">
      {targets.map(function (target) {
        const selected = target.id === selectedId;
        return (
          <li key={target.id}>
            <button
              type="button"
              onClick={() => onSelect(target.id)}
              className={`w-full px-3 py-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 ${
                selected ? 'bg-neutral-800' : 'hover:bg-neutral-900'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-xs text-neutral-400">
                  {target.repo}#{target.pr}
                </span>
                <VerdictBadge verdict={target.latestVerdict} />
              </div>
              <div className="mt-0.5 truncate text-sm text-neutral-200">{target.title ?? '(untitled)'}</div>
              <div className="mt-0.5 text-xs text-neutral-500">
                round {target.latestRound}
                {target.author ? ` · ${target.author}` : ''}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
});

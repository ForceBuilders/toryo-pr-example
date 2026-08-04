import {lazy, memo, Suspense, useCallback, useState} from 'react';
import type {Disposition, FindingView} from '../../../src/types.ts';
import {Markdown} from './Markdown.tsx';
import {ResolutionTag, TierBadge} from './Badges.tsx';

/**
 * The markdown editor is by far the heaviest thing here: roughly two thirds of
 * the bundle, and it pulls its own stylesheet. Most sessions never click Edit,
 * so it loads on first use rather than on first paint.
 */
const MDEditor = lazy(function () {
  return import('@uiw/react-md-editor');
});

export type FindingRowProps = {
  finding: FindingView;
  latestRound: number;
  busy: boolean;
  onDispose: (id: string, disposition: Disposition) => void;
  onSaveBody: (id: string, body: string | null) => void;
  onPost: (id: string) => void;
};

/**
 * One finding: its text, an editor, and the three things an operator can do
 * with it.
 *
 * Memoised, and every handler it receives is a stable `useCallback` from the
 * parent. A PR with forty findings re-renders forty rows on every keystroke
 * otherwise.
 */
export const FindingRow = memo(function FindingRow(props: FindingRowProps) {
  const {finding, latestRound, busy, onDispose, onSaveBody, onPost} = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(finding.body);

  const startEditing = useCallback(
    function () {
      setDraft(finding.body);
      setEditing(true);
    },
    [finding.body],
  );

  const save = useCallback(
    function () {
      onSaveBody(finding.id, draft);
      setEditing(false);
    },
    [draft, finding.id, onSaveBody],
  );

  const revert = useCallback(
    function () {
      onSaveBody(finding.id, null);
      setEditing(false);
    },
    [finding.id, onSaveBody],
  );

  const posted = finding.disposition === 'posted';
  const muted = finding.disposition === 'ignored' || finding.disposition === 'dismissed';

  return (
    <li className={`rounded border border-neutral-800 bg-neutral-900/50 p-3 ${muted ? 'opacity-50' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <TierBadge tier={finding.tier} />
        <span className="font-medium text-neutral-100">{finding.title}</span>
        <ResolutionTag resolution={finding.resolution} round={latestRound} />
        {finding.edited && <span className="text-xs text-violet-400">edited</span>}
        {posted && <span className="text-xs text-emerald-400">posted</span>}
      </div>

      <div className="mt-1 font-mono text-xs text-neutral-500">
        {finding.file}
        {finding.line === null ? '' : `:${finding.line}`}
        {finding.line === null && <span className="ml-2 text-neutral-600">(no line, posts in the review body)</span>}
      </div>

      {editing ? (
        <div className="mt-2" data-color-mode="dark">
          <Suspense fallback={<div className="h-[220px] rounded bg-neutral-900 p-3 text-xs text-neutral-500">Loading editor…</div>}>
            <MDEditor value={draft} onChange={(v) => setDraft(v ?? '')} height={220} preview="edit" />
          </Suspense>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={save} className={buttonClass('primary')} disabled={busy}>
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)} className={buttonClass()}>
              Cancel
            </button>
            {finding.edited && (
              <button type="button" onClick={revert} className={buttonClass()} disabled={busy}>
                Revert to original
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="mt-2">
            <Markdown>{finding.body}</Markdown>
          </div>
          {finding.evidence && (
            <pre className="mt-2 overflow-x-auto rounded bg-neutral-950 p-2 text-xs text-neutral-400">
              {finding.evidence}
            </pre>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={startEditing} className={buttonClass()} disabled={busy}>
              Edit
            </button>
            <button type="button" onClick={() => onPost(finding.id)} className={buttonClass('primary')} disabled={busy || posted}>
              {posted ? 'Posted' : 'Post to GitHub'}
            </button>
            <button type="button" onClick={() => onDispose(finding.id, 'ignored')} className={buttonClass()} disabled={busy}>
              Ignore
            </button>
            <button type="button" onClick={() => onDispose(finding.id, 'dismissed')} className={buttonClass()} disabled={busy}>
              Dismiss
            </button>
            {finding.disposition !== 'pending' && (
              <button type="button" onClick={() => onDispose(finding.id, 'pending')} className={buttonClass()} disabled={busy}>
                Reset
              </button>
            )}
          </div>
        </>
      )}
    </li>
  );
});

function buttonClass(kind?: 'primary'): string {
  const base =
    'rounded px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500';
  return kind === 'primary'
    ? `${base} bg-sky-800 text-sky-100 hover:bg-sky-700`
    : `${base} bg-neutral-800 text-neutral-300 hover:bg-neutral-700`;
}

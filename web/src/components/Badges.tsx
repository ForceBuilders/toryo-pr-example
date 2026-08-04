import {memo} from 'react';
import type {Resolution, Tier} from '../../../src/types.ts';

const TIER_STYLE: Record<Tier, string> = {
  T1: 'bg-red-950 text-red-300 ring-red-900',
  T2: 'bg-amber-950 text-amber-300 ring-amber-900',
  T3: 'bg-sky-950 text-sky-300 ring-sky-900',
  T4: 'bg-neutral-800 text-neutral-400 ring-neutral-700',
};

const TIER_LABEL: Record<Tier, string> = {
  T1: 'Blocking',
  T2: 'Should fix',
  T3: 'Consider',
  T4: 'Nit',
};

/** Severity in words. `T1` means nothing to anyone who has not read the rubric. */
export const TierBadge = memo(function TierBadge({tier}: {tier: Tier}) {
  return <span className={`rounded px-1.5 py-0.5 text-xs ring-1 ${TIER_STYLE[tier]}`}>{TIER_LABEL[tier]}</span>;
});

const VERDICT_STYLE: Record<string, string> = {
  approve: 'bg-emerald-950 text-emerald-300 ring-emerald-900',
  comment: 'bg-sky-950 text-sky-300 ring-sky-900',
  request_changes: 'bg-red-950 text-red-300 ring-red-900',
};

/**
 * The verdict is a stored signal, never submitted to GitHub as an approval.
 * The label says "signal" so nobody reads it as the review having been filed.
 */
export const VerdictBadge = memo(function VerdictBadge({verdict}: {verdict: string | null}) {
  if (!verdict) return null;
  const style = VERDICT_STYLE[verdict] ?? 'bg-neutral-800 text-neutral-400 ring-neutral-700';
  return <span className={`rounded px-1.5 py-0.5 text-xs ring-1 ${style}`}>{verdict.replace('_', ' ')}</span>;
});

const RESOLUTION_LABEL: Record<Resolution, string> = {
  new: 'new',
  not_addressed: 'still open',
  regressed: 'regressed',
  addressed: 'fixed',
};

const RESOLUTION_STYLE: Record<Resolution, string> = {
  new: 'text-sky-400',
  not_addressed: 'text-amber-400',
  regressed: 'text-red-400',
  addressed: 'text-emerald-400',
};

/** Only meaningful from round 2 on: round 1 is all `new` and saying so is noise. */
export const ResolutionTag = memo(function ResolutionTag({resolution, round}: {resolution: Resolution; round: number}) {
  if (round < 2) return null;
  return <span className={`text-xs ${RESOLUTION_STYLE[resolution]}`}>{RESOLUTION_LABEL[resolution]}</span>;
});

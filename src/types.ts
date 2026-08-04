import {z} from 'zod';

/**
 * The wire vocabulary, in one place.
 *
 * Two of these axes look similar and are not. **Disposition** is what the
 * operator decided about a finding, and it carries forward across rounds
 * untouched by the reviewer. **Resolution** is what the latest round observed,
 * and it is recomputed every round from presence alone. Collapsing them into
 * one column is the mistake that makes re-review useless: an ignored finding
 * would resurface un-triaged every time the agent runs again.
 */

/** Severity, worst first. The reviewer assigns it; the verdict is derived from it. */
export const TIERS = ['T1', 'T2', 'T3', 'T4'] as const;
export type Tier = (typeof TIERS)[number];

/** Operator triage. Set in the UI, carried across rounds. */
export const DISPOSITIONS = ['pending', 'posted', 'ignored', 'dismissed'] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

/** Recomputed each round from whether the finding is still present. */
export const RESOLUTIONS = ['new', 'not_addressed', 'regressed', 'addressed'] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

/**
 * A stored signal, never submitted to GitHub as an approve/request-changes
 * review. A machine does not get to approve a pull request here.
 */
export const VERDICTS = ['approve', 'comment', 'request_changes'] as const;
export type Verdict = (typeof VERDICTS)[number];

/**
 * One finding as the reviewer worker writes it into `findings.json`.
 *
 * `evidence` is required and load-bearing: it is a verbatim quote of the code
 * the finding is about, and it is what a real grounding pass would check
 * against the tree to decide whether the finding is a hallucination. This
 * example does not run that check (see the README) but keeps the field, because
 * dropping it is the thing that would make adding the check later impossible.
 */
export const findingInputSchema = z.object({
  file: z.string().min(1),
  line: z.number().int().positive().nullable().optional(),
  tier: z.enum(TIERS),
  title: z.string().min(1),
  body: z.string().min(1),
  evidence: z.string().default(''),
});
export type FindingInput = z.infer<typeof findingInputSchema>;

/**
 * `findings.json`: the artifact the sequence's `review` step writes, and the
 * only thing that crosses from toryo back into this app.
 *
 * It is deliberately **self-describing**: it names its own repo and PR rather
 * than relying on the reader to remember which run was which. That is what lets
 * `pr-example ingest --run <id>` work from nothing but a run id, and it means an
 * artifact left on disk by a run nobody watched is still fully recoverable.
 */
export const roundArtifactSchema = z.object({
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'repo must be owner/name'),
  pr: z.number().int().positive(),
  headSha: z.string().min(1),
  verdict: z.enum(VERDICTS),
  summary: z.string().default(''),
  findings: z.array(findingInputSchema).default([]),
  title: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  baseRef: z.string().nullable().optional(),
  headRef: z.string().nullable().optional(),
});
export type RoundArtifact = z.infer<typeof roundArtifactSchema>;

/** What `record()` takes: the artifact, plus the toryo project it came from. */
export type RecordInput = RoundArtifact & {projectId?: string | null};

/** Per-round tally, stored as JSON on the round and shown in the UI. */
export type RoundCounts = Record<Resolution, number>;

/** A finding as the API hands it out: effective text, plus what it was raw. */
export type FindingView = {
  id: string;
  findingId: string;
  file: string;
  line: number | null;
  tier: Tier;
  title: string;
  /** `bodyOverrideMd ?? bodyMd`: what gets posted. */
  body: string;
  /** True when an operator edited the body. */
  edited: boolean;
  rawBody: string;
  evidence: string;
  disposition: Disposition;
  resolution: Resolution;
  present: boolean;
  firstSeenRound: number;
  lastSeenRound: number;
  postedAt: string | null;
};

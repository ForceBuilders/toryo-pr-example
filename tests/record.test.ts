import {describe, it, expect, beforeEach} from 'bun:test';
import {record} from '../src/record.ts';
import {getTargetByPr, getTargetDetail} from '../src/queries.ts';
import {dispose, editBody} from '../src/triage.ts';
import type {Db} from '../src/db/client.ts';
import {artifact, finding, testDb} from './helpers/db.ts';

/**
 * Round chaining. Every interesting case here is a transition across two runs
 * of the agent, which is exactly the behaviour a single-round test cannot see.
 */

let db: Db;

beforeEach(function () {
  db = testDb();
});

function detailOf(repo = 'octo/hello', pr = 42, includeAddressed = true) {
  const target = getTargetByPr(db, repo, pr);
  if (!target) throw new Error('no target');
  return getTargetDetail(db, target.id, {includeAddressed})!;
}

describe('record', function () {
  it('should create the target and number the first round 1', function () {
    const result = record(db, artifact({findings: [finding()]}));

    expect(result.round).toBe(1);
    expect(result.counts).toEqual({new: 1, not_addressed: 0, regressed: 0, addressed: 0});
  });

  it('should increment the round on re-review of the same pull request', function () {
    record(db, artifact());

    const second = record(db, artifact());

    expect(second.round).toBe(2);
    expect(second.targetId).toBe(detailOf().target.id);
  });

  it('should mark a finding still present as not_addressed', function () {
    record(db, artifact({findings: [finding()]}));

    const second = record(db, artifact({findings: [finding()]}));

    expect(second.counts.not_addressed).toBe(1);
    expect(detailOf().findings[0]!.resolution).toBe('not_addressed');
  });

  it('should mark a finding that disappeared as addressed', function () {
    record(db, artifact({findings: [finding()]}));

    const second = record(db, artifact({findings: []}));

    expect(second.counts.addressed).toBe(1);
    const view = detailOf().findings[0]!;
    expect(view.resolution).toBe('addressed');
    expect(view.present).toBe(false);
  });

  it('should mark a finding that came back as regressed', function () {
    record(db, artifact({findings: [finding()]}));
    record(db, artifact({findings: []}));

    const third = record(db, artifact({findings: [finding()]}));

    expect(third.counts.regressed).toBe(1);
    expect(detailOf().findings[0]!.resolution).toBe('regressed');
  });

  it('should not count an already-addressed finding as addressed twice', function () {
    record(db, artifact({findings: [finding()]}));
    record(db, artifact({findings: []}));

    const third = record(db, artifact({findings: []}));

    expect(third.counts.addressed).toBe(0);
  });

  it('should chain a finding whose line moved, because line is not part of its identity', function () {
    record(db, artifact({findings: [finding({line: 10})]}));

    const second = record(db, artifact({findings: [finding({line: 87})]}));

    expect(second.counts).toMatchObject({new: 0, not_addressed: 1});
    expect(detailOf().findings).toHaveLength(1);
    expect(detailOf().findings[0]!.line).toBe(87);
  });

  it('should chain a finding whose tier was re-judged', function () {
    record(db, artifact({findings: [finding({tier: 'T3'})]}));

    const second = record(db, artifact({findings: [finding({tier: 'T1'})]}));

    expect(second.counts.not_addressed).toBe(1);
    expect(detailOf().findings[0]!.tier).toBe('T1');
  });

  it('should carry the operator disposition forward untouched', function () {
    record(db, artifact({findings: [finding()]}));
    const first = detailOf().findings[0]!;
    dispose(db, first.id, 'ignored');

    record(db, artifact({findings: [finding()]}));

    expect(detailOf().findings[0]!.disposition).toBe('ignored');
  });

  it('should preserve an operator edit through a re-review that rewrites the raw body', function () {
    record(db, artifact({findings: [finding({body: 'original agent prose'})]}));
    const first = detailOf().findings[0]!;
    editBody(db, first.id, 'what the operator actually wants to say');

    record(db, artifact({findings: [finding({body: 'completely reworded by the model'})]}));

    const after = detailOf().findings[0]!;
    expect(after.body).toBe('what the operator actually wants to say');
    expect(after.rawBody).toBe('completely reworded by the model');
    expect(after.edited).toBe(true);
  });

  it('should keep first_seen_round at the round the finding actually appeared', function () {
    record(db, artifact({findings: []}));
    record(db, artifact({findings: [finding()]}));

    record(db, artifact({findings: [finding()]}));

    const view = detailOf().findings[0]!;
    expect(view.firstSeenRound).toBe(2);
    expect(view.lastSeenRound).toBe(3);
  });

  it('should collapse two identical findings in one round into one row', function () {
    const result = record(db, artifact({findings: [finding(), finding()]}));

    expect(result.counts.new).toBe(1);
    expect(detailOf().findings).toHaveLength(1);
  });

  it('should keep separate findings about the same file apart', function () {
    const result = record(
      db,
      artifact({
        findings: [finding({title: 'First problem', evidence: 'const a = 1;'}), finding({title: 'Second problem', evidence: 'const b = 2;'})],
      }),
    );

    expect(result.counts.new).toBe(2);
  });

  it('should track two pull requests independently', function () {
    record(db, artifact({repo: 'octo/hello', pr: 1, findings: [finding()]}));

    const other = record(db, artifact({repo: 'octo/hello', pr: 2, findings: [finding()]}));

    expect(other.round).toBe(1);
    expect(other.counts.new).toBe(1);
  });

  it('should update the target with the latest verdict and metadata', function () {
    record(db, artifact({verdict: 'approve', title: 'A change', author: 'octocat', headRef: 'feat/x'}));

    const target = detailOf().target;
    expect(target.latestVerdict).toBe('approve');
    expect(target.title).toBe('A change');
    expect(target.author).toBe('octocat');
    expect(target.headRef).toBe('feat/x');
  });

  it('should store a per-round count tally', function () {
    record(db, artifact({findings: [finding()]}));
    record(db, artifact({findings: []}));

    const rounds = detailOf().rounds;
    expect(JSON.parse(rounds[0]!.countsJson)).toMatchObject({new: 1});
    expect(JSON.parse(rounds[1]!.countsJson)).toMatchObject({addressed: 1});
  });

  it('should hide addressed findings from the default view', function () {
    record(db, artifact({findings: [finding()]}));
    record(db, artifact({findings: []}));

    expect(detailOf('octo/hello', 42, false).findings).toHaveLength(0);
    expect(detailOf('octo/hello', 42, true).findings).toHaveLength(1);
  });
});

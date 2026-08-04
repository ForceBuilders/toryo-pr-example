import {describe, it, expect} from 'bun:test';
import {commentBody, parsePrRef, prUrl} from '../src/gh.ts';
import type {FindingView} from '../src/types.ts';

function view(overrides: Partial<FindingView> = {}): FindingView {
  return {
    id: 'row-1',
    findingId: 'abcdef0123456789',
    file: 'src/thing.ts',
    line: 12,
    tier: 'T1',
    title: 'Drops the error',
    body: 'The catch returns null without logging.',
    edited: false,
    rawBody: 'The catch returns null without logging.',
    evidence: 'catch (e) { return null; }',
    disposition: 'pending',
    resolution: 'new',
    present: true,
    firstSeenRound: 1,
    lastSeenRound: 1,
    postedAt: null,
    ...overrides,
  };
}

describe('commentBody', function () {
  it('should translate the tier into words rather than leaking T1', function () {
    const body = commentBody(view({tier: 'T1'}));

    expect(body).toContain('Blocking');
    expect(body).not.toContain('T1');
  });

  it('should use a different word for each tier', function () {
    const words = (['T1', 'T2', 'T3', 'T4'] as const).map((tier) => commentBody(view({tier})).split(':')[0]);

    expect(new Set(words).size).toBe(4);
  });

  it('should post the operator edit, not the original', function () {
    const body = commentBody(view({body: 'the edited text', rawBody: 'the agent text', edited: true}));

    expect(body).toContain('the edited text');
    expect(body).not.toContain('the agent text');
  });
});

describe('parsePrRef', function () {
  it('should parse owner/name#123', function () {
    expect(parsePrRef('octo/hello#123')).toEqual({repo: 'octo/hello', pr: 123});
  });

  it('should parse a pull request URL', function () {
    expect(parsePrRef('https://github.com/octo/hello/pull/7')).toEqual({repo: 'octo/hello', pr: 7});
  });

  it('should parse a URL with a trailing path, as pasted from the files tab', function () {
    expect(parsePrRef('https://github.com/octo/hello/pull/7/files')).toEqual({repo: 'octo/hello', pr: 7});
  });

  it('should accept dots and dashes in a repository name', function () {
    expect(parsePrRef('my-org/some.repo#1')).toEqual({repo: 'my-org/some.repo', pr: 1});
  });

  it('should reject something that is not a pull request reference', function () {
    expect(parsePrRef('octo/hello')).toBeNull();
    expect(parsePrRef('just some text')).toBeNull();
  });
});

describe('prUrl', function () {
  it('should build the canonical pull request link', function () {
    expect(prUrl('octo/hello', 42)).toBe('https://github.com/octo/hello/pull/42');
  });
});

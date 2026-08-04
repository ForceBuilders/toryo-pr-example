import {describe, it, expect} from 'bun:test';
import {roundArtifactSchema} from '../src/types.ts';
import {artifact, finding} from './helpers/db.ts';

/**
 * `findings.json` is written by a language model, so it is the least
 * trustworthy input in the system. Everything the store believes about a round
 * passes through this schema first.
 */
describe('roundArtifactSchema', function () {
  it('should accept a well-formed artifact', function () {
    expect(roundArtifactSchema.safeParse(artifact({findings: [finding()]})).success).toBe(true);
  });

  it('should default an omitted findings list to empty rather than failing', function () {
    const parsed = roundArtifactSchema.safeParse({
      repo: 'octo/hello',
      pr: 1,
      headSha: 'abc',
      verdict: 'approve',
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.findings).toEqual([]);
  });

  it('should reject a verdict outside the enum', function () {
    expect(roundArtifactSchema.safeParse(artifact({verdict: 'lgtm' as never})).success).toBe(false);
  });

  it('should reject a repo that is not owner/name', function () {
    expect(roundArtifactSchema.safeParse(artifact({repo: 'hello' as never})).success).toBe(false);
  });

  it('should reject a tier the rubric does not define', function () {
    const parsed = roundArtifactSchema.safeParse(artifact({findings: [finding({tier: 'T9' as never})]}));

    expect(parsed.success).toBe(false);
  });

  it('should accept a null line, for a finding with no single location', function () {
    expect(roundArtifactSchema.safeParse(artifact({findings: [finding({line: null})]})).success).toBe(true);
  });

  it('should reject a finding with an empty body, which is never useful', function () {
    expect(roundArtifactSchema.safeParse(artifact({findings: [finding({body: ''})]})).success).toBe(false);
  });

  it('should allow missing evidence but default it to a string', function () {
    const {evidence: _dropped, ...withoutEvidence} = finding();
    const parsed = roundArtifactSchema.safeParse(artifact({findings: [withoutEvidence as never]}));

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.findings[0]!.evidence).toBe('');
  });

  it('should reject a pr number that is not a positive integer', function () {
    expect(roundArtifactSchema.safeParse(artifact({pr: 0})).success).toBe(false);
    expect(roundArtifactSchema.safeParse(artifact({pr: 1.5})).success).toBe(false);
  });
});

import {describe, it, expect} from 'bun:test';
import {findingId} from '../src/finding-id.ts';

/**
 * Identity is the load-bearing idea in this repo, so these tests are as much
 * documentation as verification: what must change the hash, and what must not.
 */

const base = {file: 'src/thing.ts', title: 'Unhandled error path', evidence: 'catch (e) { return null; }'};

describe('findingId', function () {
  it('should be stable for the same finding', function () {
    expect(findingId(base)).toBe(findingId({...base}));
  });

  it('should ignore the directory, so moving a file does not orphan its findings', function () {
    const moved = {...base, file: 'src/lib/deep/thing.ts'};

    expect(findingId(moved)).toBe(findingId(base));
  });

  it('should ignore reindentation of the evidence', function () {
    const reindented = {...base, evidence: '    catch (e) {\n      return null;\n    }'};

    expect(findingId(reindented)).toBe(findingId(base));
  });

  it('should ignore capitalisation of the title', function () {
    expect(findingId({...base, title: 'UNHANDLED ERROR PATH'})).toBe(findingId(base));
  });

  it('should change when the evidence is different code', function () {
    expect(findingId({...base, evidence: 'catch (e) { throw e; }'})).not.toBe(findingId(base));
  });

  it('should change when the claim is different', function () {
    expect(findingId({...base, title: 'Missing null check'})).not.toBe(findingId(base));
  });

  it('should distinguish same-named files in different trees only by their content', function () {
    // Basename collisions are real (`index.ts` everywhere). Evidence is what
    // separates them, which is why it is in the hash and the path is not.
    const a = {file: 'a/index.ts', title: 'Same claim', evidence: 'const a = 1;'};
    const b = {file: 'b/index.ts', title: 'Same claim', evidence: 'const b = 2;'};

    expect(findingId(a)).not.toBe(findingId(b));
  });

  it('should tolerate missing evidence without throwing', function () {
    expect(findingId({file: 'src/thing.ts', title: 'No evidence', evidence: ''})).toHaveLength(16);
  });
});

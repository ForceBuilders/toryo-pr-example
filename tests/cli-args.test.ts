import {describe, it, expect} from 'bun:test';
import {parseFlags, int, list, str, type FlagSpec} from '../src/cli/args.ts';

/**
 * The argv edge cases, tested once. This is the argument for a shared parser:
 * six commands would otherwise each need their own version of this file, and
 * would each get a different subset of it right.
 */

const SPECS = [
  {name: 'repo', short: 'r', takesValue: true, required: true, describe: 'owner/name'},
  {name: 'pr', takesValue: true, describe: 'number'},
  {name: 'all', takesValue: false, describe: 'include everything'},
  {name: 'finding-id', takesValue: true, multiple: true, describe: 'repeatable'},
  {name: 'mode', takesValue: true, default: 'fast', describe: 'has a default'},
] as const satisfies readonly FlagSpec[];

function parse(argv: string[]) {
  return parseFlags(argv, SPECS);
}

describe('parseFlags', function () {
  it('should read a long flag and its value', function () {
    const r = parse(['--repo', 'octo/hello']);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(str(r.flags, 'repo')).toBe('octo/hello');
  });

  it('should read a short flag', function () {
    const r = parse(['-r', 'octo/hello']);

    expect(r.ok && str(r.flags, 'repo')).toBe('octo/hello');
  });

  it('should accept --name=value as well as --name value', function () {
    const r = parse(['--repo=octo/hello']);

    expect(r.ok && str(r.flags, 'repo')).toBe('octo/hello');
  });

  it('should treat a switch as true without consuming the next token', function () {
    const r = parse(['--all', '--repo', 'octo/hello']);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.flags.all).toBe(true);
    expect(str(r.flags, 'repo')).toBe('octo/hello');
  });

  it('should collect a repeated flag into an array', function () {
    const r = parse(['--repo', 'x/y', '--finding-id', 'a', '--finding-id', 'b']);

    expect(r.ok && list(r.flags, 'finding-id')).toEqual(['a', 'b']);
  });

  it('should apply a declared default', function () {
    const r = parse(['--repo', 'x/y']);

    expect(r.ok && str(r.flags, 'mode')).toBe('fast');
  });

  it('should let an explicit value beat the default', function () {
    const r = parse(['--repo', 'x/y', '--mode', 'slow']);

    expect(r.ok && str(r.flags, 'mode')).toBe('slow');
  });

  it('should reject an unknown flag and name the valid ones', function () {
    const r = parse(['--repo', 'x/y', '--nope', '1']);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain('unknown flag --nope');
    expect(r.message).toContain('--repo');
  });

  it('should reject a value flag at the end of argv with nothing after it', function () {
    const r = parse(['--repo']);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain('requires a value');
  });

  it('should reject a missing required flag', function () {
    const r = parse(['--all']);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toContain('--repo');
  });

  it('should collect positionals', function () {
    const r = parse(['--repo', 'x/y', 'one', 'two']);

    expect(r.ok && r.positionals).toEqual(['one', 'two']);
  });

  it('should treat everything after -- as positional, even flag-shaped tokens', function () {
    const r = parse(['--repo', 'x/y', '--', '--all', '--nope']);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.positionals).toEqual(['--all', '--nope']);
    expect(r.flags.all).toBeUndefined();
  });

  it('should let a later occurrence of a single-valued flag win', function () {
    const r = parse(['--repo', 'first/one', '--repo', 'second/one']);

    expect(r.ok && str(r.flags, 'repo')).toBe('second/one');
  });
});

describe('int', function () {
  it('should parse a positive integer', function () {
    const r = parse(['--repo', 'x/y', '--pr', '42']);

    expect(r.ok && int(r.flags, 'pr')).toBe(42);
  });

  it('should reject a non-integer rather than returning NaN', function () {
    const r = parse(['--repo', 'x/y', '--pr', 'twelve']);

    expect(r.ok && int(r.flags, 'pr')).toBeUndefined();
  });

  it('should reject zero and negatives, which are never valid PR numbers', function () {
    const zero = parse(['--repo', 'x/y', '--pr', '0']);
    // A leading `-` is taken as a value, not as the next flag: negative numbers
    // are legitimate values elsewhere, so the range check belongs here, not in
    // the tokenizer.
    const negative = parse(['--repo', 'x/y', '--pr', '-3']);

    expect(zero.ok && int(zero.flags, 'pr')).toBeUndefined();
    expect(negative.ok && str(negative.flags, 'pr')).toBe('-3');
    expect(negative.ok && int(negative.flags, 'pr')).toBeUndefined();
  });
});

/**
 * A declarative argv parser: commands describe their flags as data, one parser
 * interprets them.
 *
 * The alternative is a hand-rolled `for (let i = 0; …)` loop per command, each
 * reinventing "does this flag take a value", "was a required one missing", and
 * "what happens at the end of argv". Six commands means six chances to get the
 * same edge case wrong in six different ways. One parser means one place to fix
 * and one place to test.
 */

export type FlagSpec = {
  name: string;
  short?: string;
  /** False for a boolean switch: present means true, no value is consumed. */
  takesValue: boolean;
  required?: boolean;
  /** Repeatable, collecting into an array (`--id a --id b`). */
  multiple?: boolean;
  default?: string | boolean;
  describe: string;
};

export type FlagValues = Record<string, string | boolean | string[] | undefined>;

export type ParseResult =
  | {ok: true; flags: FlagValues; positionals: string[]}
  | {ok: false; message: string};

export function parseFlags(argv: string[], specs: readonly FlagSpec[]): ParseResult {
  const byLong = new Map(specs.map((s) => [`--${s.name}`, s]));
  const byShort = new Map(specs.filter((s) => s.short).map((s) => [`-${s.short}`, s]));

  const flags: FlagValues = {};
  const positionals: string[] = [];
  for (const spec of specs) {
    if (spec.default !== undefined) flags[spec.name] = spec.default;
    if (spec.multiple) flags[spec.name] = [];
  }

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;

    // Everything after a bare `--` is positional, even if it looks like a flag.
    if (token === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (!token.startsWith('-')) {
      positionals.push(token);
      continue;
    }

    // `--name=value` as well as `--name value`; both are idiomatic and callers
    // reach for whichever they are used to.
    const eq = token.indexOf('=');
    const key = eq === -1 ? token : token.slice(0, eq);
    const spec = byLong.get(key) ?? byShort.get(key);
    if (!spec) {
      return {ok: false, message: `unknown flag ${key} (valid: ${specs.map((s) => `--${s.name}`).join(', ')})`};
    }

    if (!spec.takesValue) {
      flags[spec.name] = true;
      continue;
    }

    const value = eq === -1 ? argv[++i] : token.slice(eq + 1);
    if (value === undefined) return {ok: false, message: `${key} requires a value`};
    if (spec.multiple) (flags[spec.name] as string[]).push(value);
    else flags[spec.name] = value;
  }

  const missing = specs
    .filter((s) => s.required)
    .filter((s) => {
      const v = flags[s.name];
      return v === undefined || (Array.isArray(v) && v.length === 0);
    })
    .map((s) => `--${s.name}`);
  if (missing.length > 0) return {ok: false, message: `missing required flag(s): ${missing.join(', ')}`};

  return {ok: true, flags, positionals};
}

export function str(flags: FlagValues, name: string): string | undefined {
  const v = flags[name];
  return typeof v === 'string' ? v : undefined;
}

export function bool(flags: FlagValues, name: string): boolean {
  return flags[name] === true;
}

export function list(flags: FlagValues, name: string): string[] {
  const v = flags[name];
  return Array.isArray(v) ? v : [];
}

/** Parse a flag that must be a positive integer, e.g. a PR number. */
export function int(flags: FlagValues, name: string): number | undefined {
  const raw = str(flags, name);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export function usage(specs: readonly FlagSpec[]): string {
  return specs
    .map(function (s) {
      const flag = `${s.short ? `-${s.short}, ` : ''}--${s.name}${s.takesValue ? ' <value>' : ''}`;
      return `  ${flag.padEnd(28)}${s.describe}${s.required ? ' (required)' : ''}`;
    })
    .join('\n');
}

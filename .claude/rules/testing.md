# Testing

## Layout

Tests live in `tests/`, mirroring `src/`. `bun test` runs them.

## Shape

- Arrange, act, assert, with a blank line between each. The blank lines do real
  work: they make it obvious when a test has three acts and is really three
  tests.
- One logical outcome per test. Several `expect`s about the same outcome is
  fine; several outcomes is not.
- Name tests "should <expected> when <condition>".
- Factories over fixtures. Generate data with sensible defaults and override the
  one field the test is about, so the reader can see what matters.

## What to test

- The chaining logic in `src/record.ts`. It is the only genuinely subtle code
  here and every interesting case is a state transition across two rounds.
- Identity in `src/finding-id.ts`: what must change the hash, and more
  importantly what must not.
- Argument parsing, artifact parsing, and the shapes handed to `gh`.

## What not to test

- `gh` itself, or drizzle, or SQLite. Testing a dependency's behaviour tests
  that the dependency exists.
- Trivial pass-throughs.

## Isolation

Every test opens its own `:memory:` database through `PR_EXAMPLE_DB`. A test run
must never touch the operator's real review store, and tests must not depend on
each other's rows.

## Guard against short-circuits

When testing a specific branch, make sure the setup actually reaches it. A test
that passes because an earlier guard fired is worse than no test: it is green,
and it is testing nothing.

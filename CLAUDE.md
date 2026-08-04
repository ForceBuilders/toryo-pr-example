# toryo-pr-example

A GitHub PR reviewer built on [toryo](https://github.com/ForceBuilders/toryo),
written as a **teaching example**. Read [`README.md`](./README.md) first — it
explains what this demonstrates and why each piece is shaped the way it is.

Optimise for legibility over cleverness here. Someone reading this repo is
trying to learn how to build on toryo, so a clear implementation of the obvious
approach beats a compact implementation of a subtle one.

## Rules

- [`.claude/rules/code-style.md`](.claude/rules/code-style.md)
- [`.claude/rules/testing.md`](.claude/rules/testing.md)

These are also read by the reviewer when it reviews *this* repo, which is the
demo: a repo states its conventions, and the reviewer honours them.

## Shape

Two surfaces over one implementation. Everything lives in `src/`; the CLI
(`src/cli/`) and the HTTP API (`src/routes/`) both call it and neither owns any
logic. Commands and routes are standalone data objects registered by iterating
an array — never a `switch`.

The two integration boundaries are one file each, deliberately:
`src/toryo.ts` and `src/gh.ts`. Nothing else in the app shells out.

## Gates

```sh
bun test
bun run typecheck
toryo sequence validate .toryo/sequences/pr-review.yaml
```

Tests run against an in-memory database (`PR_EXAMPLE_DB=:memory:`) and never
touch the real store.

## Watch out for

- **The sequence needs toryo ≥ `CONTRACT_VERSION` 2.4.1** for declarative
  `kind: setup` steps. `unknown step kind 'setup'` means the installed toryo
  is older than the feature.
- **`findings.json` is model output**, so it is the least trustworthy input in
  the system. It is validated by `roundArtifactSchema` before anything believes
  it, and it should stay that way.
- **Never write an operator edit into `bodyMd`.** The next review round rewrites
  every raw column; edits live in `bodyOverrideMd` for exactly that reason.
- **Post to GitHub before marking anything posted.** The other order marks
  findings as sent that never left.

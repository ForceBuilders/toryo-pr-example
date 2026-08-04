# toryo-pr-example

A worked example of building something on top of [toryo](https://github.com/ForceBuilders/toryo):
a GitHub pull request reviewer with its own sequence, its own database, and its
own UI.

It is a **teaching repository**. Small enough to read in one sitting, complete
enough to actually review a pull request and post the result to GitHub. If you
are trying to work out what "build on toryo" means in practice, this is the
answer in about 2,000 lines.

## The idea

toryo is an engineering platform: it runs agent sessions, tracks them, schedules
them, and remembers things. It is deliberately not a PR reviewer, a release
manager, or a triage tool. Those are *workflows*, and workflows belong to the
teams that need them.

This repo is one such workflow. Everything domain-specific about reviewing pull
requests — the rubric, the tiers, the finding store, the triage UI, the GitHub
posting — lives here. toryo contributes the parts that are not domain-specific:
running the agent, tracking the run, and putting an artifact on disk.

## The three seams

Everything this repo does to reach toryo happens in exactly three places.

### 1. A custom sequence, as data in this repo

[`.toryo/sequences/pr-review.yaml`](.toryo/sequences/pr-review.yaml) is a
complete toryo sequence. It is not compiled into toryo, not registered with it,
and not a fork of it. Drop a YAML file in `<your-repo>/.toryo/sequences/` and
`toryo sequence run <name> --project <your-repo>` finds it.

Three steps, one of each kind that does not need a human:

- **`prepare`** (`kind: setup`) checks the pull request out, using the vetted
  `gh-pr-checkout` primitive. The clone is confined to toryo's run directory.
- **`review`** (`kind: worker`) is a Claude session rooted in that checkout. It
  reads the diff and writes `findings.json`.
- **`load`** (`kind: transform`) parses the artifact back into the run's state,
  so `toryo sequence status` shows the verdict without opening a file.

Validate before dispatching. It catches unresolvable template tokens, bad
routing, and disallowed fields:

```sh
toryo sequence validate .toryo/sequences/pr-review.yaml
```

### 2. Dispatch as the execution engine

This app never spawns Claude. It has no queue, no worker pool, and no model
credentials. It runs `toryo sequence run`, polls `toryo sequence status`, and
reads the artifact.

All of that is [`src/toryo.ts`](src/toryo.ts) — about sixty lines of
spawn-and-parse. Two conventions do the work, both frozen in toryo's
`docs/contract.md`: a read command emits exactly one JSON document on stdout
(parse the **last** non-empty line, since log lines may precede it), and exit
codes are stable (`0` ok, `64` bad args, `65` db, `67` not found).

There is no npm dependency on toryo, because there is nothing to depend on:
every `@toryo/*` package is private and unpublished. That is the design. The
CLI is the contract, and the integration is a process boundary.

### 3. Its own store and its own UI

SQLite via drizzle, a Bun HTTP server, and a React front end. toryo knows
nothing about any of it.

## The flow

```
  /pr octo/hello#42
        │
        ▼
  toryo sequence run pr-review --input @file --project toryo-pr-example
        │
        ├── prepare   gh-pr-checkout  →  ~/.toryo/sequence/<project>/<run>/checkout
        ├── review    claude session  →  ~/.toryo/sequence/<project>/<run>/findings.json
        └── load      read-json       →  verdict visible in `sequence status`
        │
        ▼
  the app polls the run, and on success reads findings.json
        │
        ▼
  record() chains the findings onto everything seen before
        │
        ▼
  you read, edit and triage them in the UI
        │
        ▼
  gh api …/pulls/42/reviews    one review, not forty comments
```

Note the direction of that middle arrow. The sequence writes a file and exits;
it does not call back into this app, does not know it exists, and does not care
whether it is running. **The artifact is the contract.** If the server was down
when the review finished, nothing is lost:

```sh
bun src/cli.ts ingest --run <runId>
```

## Setup

You need [toryo](https://github.com/ForceBuilders/toryo) installed and running,
`gh` authenticated (`gh auth login`), and Bun.

```sh
bun install
bun run db:migrate                                       # ~/.toryo-pr-example/reviews.db

toryo project add --name "toryo PR example" --root "$PWD"
export PR_EXAMPLE_PROJECT=toryo-pr-example               # the slug from the line above

toryo sequence validate .toryo/sequences/pr-review.yaml  # must print ✓
toryo sequence list --project toryo-pr-example           # pr-review must appear

bun run dev                                              # http://localhost:5173
```

Paste `owner/name#123` into the box and press Review.

> **Requires toryo with declarative `setup` steps** (`CONTRACT_VERSION` ≥ 2.4.1).
> If a run fails with `unknown step kind 'setup'`, the installed toryo predates
> them: rebuild its binaries and restart the sequence daemon.

To make the sequence available from *any* repository rather than just this one,
copy it into the global home:

```sh
cp .toryo/sequences/pr-review.yaml ~/.toryo/sequences/
```

## Tuning the reviewer, per repository

The reviewer reads its configuration **from the repository under review**, not
from this one. After the `prepare` step, the checkout is the working directory,
so the worker just looks around:

| Path in the reviewed repo | Effect |
|---|---|
| `.toryo/review-lenses/*.md` | Replaces the default rubric. See [the lenses here](.toryo/review-lenses/README.md). |
| `.claude/rules/*.md` | The repo's own conventions. A finding contradicting one is wrong; a violation of one is real. |
| `docs/personas/reviewer.md` | The voice and priorities to adopt. |

None are required. Absent, the rubric in the sequence applies.

This is the part worth copying even if you never use the rest. A team tunes how
their code gets reviewed by committing files to their own repo — no fork, no
config service, no pull request against the reviewer.

This repo carries its own set, so you can point the reviewer at this repo and
watch them take effect.

## The one idea worth stealing

[`src/finding-id.ts`](src/finding-id.ts).

Re-review a pull request and the agent produces a completely fresh set of
findings with no relationship to last time. To answer "did they fix it?" you
have to recognise the same finding across two independent, non-deterministic
runs.

The obvious key is `file:line`, and it does not work: lines move whenever
anything above them changes, tiers get re-judged, files get renamed. So hash
what is *durable* — the file's **basename**, the **evidence** (the actual quoted
code) and the **title**, all normalised — and deliberately exclude line, tier,
and body prose.

That one decision is what makes [`src/record.ts`](src/record.ts) able to report
`new` / `still open` / `regressed` / `fixed` per finding, and what lets operator
triage survive a re-review instead of demanding the same decisions again.

## Layout

```
.toryo/sequences/pr-review.yaml   the custom sequence
.toryo/review-lenses/             reviewer config, read from the repo under review
.claude/skills/pr/SKILL.md        the /pr command
src/toryo.ts                      the entire toryo integration
src/gh.ts                         the entire GitHub integration
src/finding-id.ts                 stable identity across rounds
src/record.ts                     round chaining
src/ingest.ts                     artifact → store
src/cli/                          one file per command, registered as data
src/routes/                       one file per route, registered as data
web/                              React + Vite UI
```

Two surfaces, one implementation: the CLI and the HTTP API both call the same
functions in `src/`, and neither owns any logic.

## What was deliberately left out

Named here rather than quietly omitted, because the gaps are as instructive as
the code.

**A deterministic grounding pass.** This is the big one. A model asked to review
code will occasionally produce a fluent, specific, entirely fictional finding.
The fix is mechanical, not prompt engineering: check each finding's cited file
exists, that the line is within it, and that the `evidence` quote actually
appears in the tree — then drop what fails. This example keeps `evidence`
required so the check *can* be added, and asks the worker to self-verify, but a
model checking itself is not a check. If you build one of these for real, this
is the first thing to add. toryo's own retired implementation is the reference.

**Risk scoring.** Weighting a review by how dangerous the changed paths are
(auth, migrations, payments) is genuinely useful and entirely orthogonal to
everything here, so including it would have doubled the surface and taught
nothing new.

**Quality grades.** A letter grade per category, alongside the findings.

**Stacked pull requests**, syncing human reviews back from GitHub, and a
multi-model judge panel.

## Adapting this to something else

The shape generalises past PR review. The parts to keep:

1. **A YAML sequence in your repo**, so the workflow is versioned with the code
   it serves and needs no changes to toryo.
2. **An artifact as the handoff.** A file in the run directory, validated by a
   schema on the way in. Anything the agent writes is untrusted input.
3. **A store keyed on stable identity**, so running the workflow twice
   accumulates knowledge instead of duplicating it.
4. **Human triage as a separate step from generation.** The sequence stops at
   recording. Nothing reaches GitHub without a person clicking a button.

Point 4 is a product decision, not a technical limitation, and it is the one
worth being deliberate about. The sequence *could* post its own findings. It
does not, because a review that nobody read is worse than no review.

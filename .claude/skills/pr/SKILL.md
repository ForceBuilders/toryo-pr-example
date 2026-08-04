---
name: pr
description: Review a GitHub pull request by dispatching the pr-review sequence through toryo. Use when asked to "/pr <pr>", "review PR 123", or "review this pull request".
argument-hint: <owner/name#123 | PR url>
---

# /pr — review a pull request

Dispatches this repo's `pr-review` sequence through toryo, then reports the run
id. The review itself happens in a toryo worker session, not in this
conversation: this skill's whole job is to turn an argument into a valid input
payload and hand it off.

That division is deliberate. A skill that reviewed the PR inline would burn this
session's context on someone else's diff and leave nothing durable behind. A
dispatched run is tracked, resumable, costed, and lands in a database.

## Steps

1. **Parse the argument.** Accept `owner/name#123` or a GitHub PR URL. Anything
   else: say what you expected and stop.

2. **Resolve the project.** This repo must be registered with toryo, because a
   project-scoped sequence is found relative to the project's root:

   ```sh
   toryo project resolve "$PWD"
   ```

   Exit 67 means unregistered — tell the operator to run
   `toryo project add --name "toryo PR example" --root "$PWD"` and stop. Take
   the `slug` from the JSON.

3. **Write the input to a file.** Never inline it:

   ```json
   {"repo": "owner/name", "pr": 123}
   ```

   Add `"focus"` only if the operator asked for something specific. Focus text
   is free prose, and shell-quoting free prose is how you lose a quote mark.

4. **Dispatch.**

   ```sh
   toryo sequence run pr-review --input @/tmp/pr-input.json --project <slug>
   ```

   Add `--dry-run` first if you want the resolved input echoed back before
   spending anything.

5. **Report** the run id, and how to follow it:

   - `toryo sequence status <runId>`
   - the app at http://localhost:5173, which polls the run and pulls the
     findings in the moment it finishes

Do not poll the run to completion inside this session. A review takes minutes,
and sitting in a wait loop is the one thing dispatch exists to avoid.

## If the run fails

`toryo sequence status <runId>` carries the error. The two common ones:

- **`unknown step kind 'setup'`** — the installed toryo predates declarative
  setup steps. Rebuild its binaries and restart the sequence daemon.
- **the `review` step failed its success check** — the worker did not write
  `findings.json`. The run directory
  (`~/.toryo/sequence/<projectId>/<runId>/`) has the session log.

If the run succeeded but nothing appeared in the app, the artifact is still on
disk: `bun src/cli.ts ingest --run <runId>`.

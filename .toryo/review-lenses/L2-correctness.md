# Lens L2 — Correctness and safety

Review the diff through this lens only. This is the lens that earns the review:
a missed T1 here costs more than every style finding combined.

## In scope

- **Wrong behaviour.** Off-by-one, inverted condition, a branch that cannot be
  reached, a default that silently does the opposite of what the caller meant.
- **Edge cases the diff introduces.** Empty input, a single element, null where
  the type says non-null because the value crossed a boundary unvalidated.
- **Error handling.** Swallowed errors, a `catch` that discards the cause, a
  generic message replacing the upstream one, a fallback that hides a failure
  the caller needed to know about.
- **Ordering of effects.** Two side effects where doing them in the other order
  would be recoverable and this order is not. Writing "done" to a database
  before the thing it describes actually succeeded is the classic.
- **Concurrency.** Shared mutable state, a check-then-act with an await between,
  an unbounded `Promise.all` over user-supplied input, a timer or subscription
  with no teardown.
- **Resource lifetime.** A handle, subprocess, or listener created and never
  released on the error path.
- **Type escapes.** A cast or `any` that turns a real type error into a runtime
  one. Trace what actually flows through it before calling it out — sometimes
  the cast is the honest boundary.
- **Data loss.** A write that overwrites a column another writer owns; a
  migration that drops or retypes a populated column.

## Out of scope

- Where the code lives — L1.
- Readability — L3.

## The bar

A T1 needs a failure you can describe: the input, the state, and what goes
wrong. If you cannot write that sentence, it is not a T1 — drop it or file it at
the tier you can actually justify.

Trace before you claim. "This could race" about code holding a lock, or "this
swallows the error" about a `catch` that rethrows with `cause`, is worse than
silence: it costs the reader time and teaches them the reviewer does not read
carefully.

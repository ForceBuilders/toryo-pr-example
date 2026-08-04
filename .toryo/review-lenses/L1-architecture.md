# Lens L1 — Architecture and boundaries

Review the diff through this lens only. Correctness bugs belong to L2, style to
L3; if you notice one, leave it for that lens rather than half-covering it here.

## In scope

- **Placement.** Does this code live where its responsibility lives? Business
  logic reaching into HTTP handling, a route that knows about SQL, a pure module
  that suddenly spawns a process.
- **Boundaries.** Does a module reach past its interface into another's
  internals? In a monorepo: does an import cross a package boundary that is
  supposed to be closed?
- **Coupling introduced by the diff.** A new dependency edge between two things
  that were independent is worth a finding even when each side is fine, because
  it is the edge that will be expensive later.
- **Duplication of an existing capability.** A new helper that reimplements
  something already exported nearby. Search before asserting this — a
  near-duplicate that handles a different case is not duplication.
- **Abstractions with one caller.** An interface, factory, or strategy
  introduced for a single implementation and no stated second one. Speculative
  generality costs more than the copy-paste it replaces.
- **Data over control flow.** A `switch` or if/else chain growing one branch per
  variant, where a registry of typed definitions would let the next variant be a
  new file instead of an edit to a shared function.
- **Error propagation shape.** Whether failures cross boundaries as values the
  caller must handle, or as exceptions thrown past several layers that cannot do
  anything about them.

## Out of scope

- Whether the logic is *right* — L2.
- Naming, formatting, comment density — L3.

## What a good L1 finding looks like

Name the two things that should not be touching, and say where the code should
have gone instead. "This violates separation of concerns" is not a finding;
"`routes/post-target.ts` builds the GitHub payload inline, which belongs in
`gh.ts` alongside the other API shapes" is.

Be willing to return nothing. Most PRs do not change the architecture, and
inventing an L1 finding to look thorough is how a reviewer teaches people to
ignore it.

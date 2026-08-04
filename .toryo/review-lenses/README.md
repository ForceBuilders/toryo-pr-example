# Review lenses

The reviewer reads these files **from the repository under review**, not from
this one. That is the point: a team tunes how their code gets reviewed by
committing files to their own repo, and never touches the sequence or this app.

The sequence's `review` step is told to look for `.toryo/review-lenses/*.md` in
the checkout and, if it finds them, use them in place of its built-in rubric.
Absent, the default rubric applies and everything still works.

This repo carries its own set, so you can point the reviewer at this repo and
watch them take effect.

## What a lens is for

Three passes over the same diff, each with a narrow remit, beat one pass told to
"find problems". A single undifferentiated pass reliably produces a pile of
style nits and misses the race condition, because nits are easy to see and races
are not. Splitting the job forces attention onto each category in turn.

The three here are a starting point, not a rule:

| Lens | Question it asks |
|---|---|
| [L1 architecture](./L1-architecture.md) | Is this in the right place, with the right boundaries? |
| [L2 correctness](./L2-correctness.md) | Will this do the wrong thing? |
| [L3 style](./L3-style.md) | Will the next person understand this? |

Add, remove, or rewrite them. A repo whose real risk is database migrations
should have a migrations lens; one with no database should not carry L2's query
advice.

## Keep them about *this* repo

A lens that repeats general programming advice adds tokens and no signal — the
model already knows what a race condition is. A lens earns its place by saying
what is true **here**: which directories are load-bearing, which mistake this
team keeps making, which pattern was chosen deliberately and should stop being
flagged.

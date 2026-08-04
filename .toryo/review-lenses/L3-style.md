# Lens L3: clarity and convention

Review the diff through this lens only, and review it *last*. This is the lens
most likely to produce noise, so hold it to a higher bar than the other two.

## In scope

- **Repository conventions.** Read `.claude/rules/*.md` in the checkout first.
  A violation of a rule the repo states is a real finding; a violation of a
  preference you brought with you is not.
- **Names that mislead.** A function called `get*` that writes, a boolean named
  for the opposite of what it holds, a variable whose name describes the old
  behaviour after a change.
- **Comments.** Missing where the code says *what* but not *why* a surprising
  choice was made. Present but stale, describing behaviour the diff just
  changed. A wrong comment is worse than none.
- **Dead code.** Unused imports, exports nothing references, commented-out
  blocks, a parameter every caller passes the same value for.
- **Debug residue.** Stray logging, a hardcoded test value, a `TODO` with no
  owner or issue.
- **Deprecated APIs.** A call the language, runtime, or a dependency has already
  marked deprecated, where the replacement is a drop-in.
- **Test quality.** A test asserting the mock rather than the behaviour; a name
  that does not say what is expected under what condition; a branch the diff
  adds with no test at all. Absent tests for new logic are usually T2, not T3.

## Out of scope

- Formatting a formatter owns. If the repo runs Prettier or an equivalent, never
  file a finding about spacing, quotes, or line breaks: the tool wins and the
  finding is pure noise.
- Anything L1 or L2 covers.

## The bar

Most L3 findings are T4, and most T4 findings should not be written down. Ten
nits attached to a PR do not make the code better; they make the next review
easier to ignore, and they bury the one finding that mattered.

Ask before writing one: would a competent author, reading this, change the code
and be glad you said it? If the honest answer is "they would sigh and comply",
drop it.

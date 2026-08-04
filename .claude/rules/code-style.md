# Code style

The reviewer reads this file out of the checkout and treats it as authority: a
violation of a rule stated here is a real finding, and a "finding" that
contradicts one is wrong.

That cuts both ways, which is the useful part. Writing a convention down here
stops the reviewer arguing with it on every pull request.

## Formatting

- Single quotes, semicolons, trailing commas.
- ES modules only. No `require`.

## Structure

- Prefer `function` declarations to arrow functions for anything named.
- Prefer `map` / `filter` / `reduce` to imperative loops, except where an early
  exit or an `await` in the body makes a `for` genuinely clearer.
- One definition per file when a module would otherwise export several things of
  the same structural kind — commands, routes, primitives. See `src/cli/commands/`
  and `src/routes/` for both halves of that pattern.
- Register those definitions by iterating an array, never by growing a `switch`.

## Comments

Comments explain **why**, not what. A comment restating the line below it is
noise; a comment explaining why the obvious approach was rejected is the most
valuable thing in the file.

Be terse. Two sentences of reasoning beats a paragraph of narration.

## Types

- No `any`. `unknown` only behind a type guard.
- Casts are a smell: they mean the types are wrong somewhere upstream.
- Discriminated unions for anything with states.

## Hygiene

- No dead code. Delete it rather than commenting it out; git remembers.
- No debug logging left behind. Production logging needs a stated purpose.
- No deprecated calls where a drop-in replacement exists.

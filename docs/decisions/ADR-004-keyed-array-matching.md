# ADR-004: Keyed array matching mode

Date: 2026-09-16
Status: Accepted by explicit user approval

## Decision

Add a third, opt-in array comparison mode, "keyed", alongside "ordered" and "unordered".
In keyed mode the user provides an ordered list of candidate key field names (a single global
setting, `ComparisonOptions.keyFields`). For each array of objects, the engine selects the
first candidate key that is present with a primitive value on every item and unique within
each side, then pairs Response A and Response B items by that key value and diffs each pair
through the normal comparison. Items whose key exists on only one side become `removed` /
`added`. Arrays that cannot be keyed unambiguously — duplicate key value, a key missing on
some item, a non-primitive key value, or non-object items — fall back to the existing
"unordered" canonical matching.

The default array mode remains "ordered". No existing mode changes meaning. Per-array
correspondence is still A-indexed, and `arrayMatches` now records keyed pairs in addition to
unordered canonical pairs.

## Rationale and consequences

API responses commonly carry arrays of entities that are unordered and where an item may
differ in a single field. Ordered mode produces index-shift noise; unordered mode reports such
an item as a whole-object `removed` + `added`, hiding which field changed. Keyed mode is the
requested, direct fix: pairing by a stable identity yields a single field-level finding.

Constitution Article II.3 constrains **unordered** matching against inventing pairing between
unrelated objects. Keyed matching is explicit and user-directed, and defers to the defined
unordered behavior whenever it cannot pair unambiguously, so it does not weaken that
guarantee. This is a compatible addition (minor amendment, constitution 3.1.0), not a change
to existing comparison semantics.

Structure/schema comparison treats keyed like unordered (order-independent union of keys),
because inferring schema per paired index would impose a correspondence that schema findings
deliberately avoid.

Consequence, stated plainly: users must choose keyed mode and supply key names; a key that is
not usable for a given array silently falls back to unordered matching for that array (this is
documented in the UI note, but there is no per-array signal in the results telling the user a
fallback occurred). Surfacing that fallback is a possible follow-up, not part of this change.

## Rollback

Remove the "keyed" member from `ArrayMode` and the keyed engine branch, drop `keyFields` from
`ComparisonOptions`, the UI control, and the report line, and revert the structure/panel guards
and the constitution to 3.0.x. No persisted or exported format depends on keyed output, so no
data migration is required.

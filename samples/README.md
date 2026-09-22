# Structure Schema Compare vs. Missing Fields — manual test

Load `baseline.json` into **Baseline** and `candidate.json` into **Candidate**
(drag/drop, "Add" → choose file, or "Quick upload"), then Compare. Expected
result, one row each:

| Path | Where it should show up | Why |
| --- | --- | --- |
| `data.region` | Missing Fields (Only in Baseline) | Present only in Baseline |
| `data.discount` | Missing Fields (Only in Candidate) | Present only in Candidate |
| `data.amount` | Differences (changed) | `100` → `150` |
| `data.tags[0]` / `data.tags[1]` | Differences (changed) | Reordered under ordered-array mode |
| `meta.version` | Differences (type-changed) | `1` (number) → `"1"` (string) |
| `data.records[1].code` | **Structure Schema Compare only** | Baseline's own item 1 lacks a field item 0 has. `records` is identical on both sides, so Missing Fields/Differences have nothing to say about it — this is the one row that should appear *only* in Structure. |

Before the structure.ts fix, `data.region` and `data.discount` also showed up
in Structure Schema Compare as `missing-in-b`/`extra-in-b`, duplicating the
Missing Fields rows. After the fix, Structure should show exactly the one
`records[1].code` row and nothing else.

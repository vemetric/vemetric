# Master Redis Search Query Syntax

The Redis Search query DSL composes operators (AND, OR, NOT, optional), field-scoped predicates (`@field:value`), and delimiter-specific value forms (TAG `{}`, NUMERIC `[]`, TEXT phrase `""`). Most "empty result" bugs come from picking the wrong delimiter or forgetting to escape special characters in TAG values.

Before writing the query expression, anchor terminology in [search-syntax-primitives.md](search-syntax-primitives.md) (Query Term, Field Identifier, Delimiters, Operators).

**Correct:** Operator and delimiter reference, against the canonical Bicycle dataset.

```
# Field scoping — TEXT (free-text, tokenized + stemmed)
FT.SEARCH idx:bicycle "@description:wireless"                 DIALECT 2

# TAG — exact match with { }; pipe = OR
FT.SEARCH idx:bicycle "@condition:{new|refurbished}"          DIALECT 2

# NUMERIC range — inclusive [], exclusive ( prefix, +inf/-inf supported
FT.SEARCH idx:bicycle "@price:[100 500]"                      DIALECT 2
FT.SEARCH idx:bicycle "@price:[(100 (500]"                    DIALECT 2
FT.SEARCH idx:bicycle "@price:[-inf 200]"                     DIALECT 2

# TEXT phrase — quotes for exact ordering
FT.SEARCH idx:bicycle "\"mountain bicycle\""                  DIALECT 2

# TEXT prefix / suffix / infix wildcards
FT.SEARCH idx:bicycle "@model:bik*"                           DIALECT 2
FT.SEARCH idx:bicycle "@model:*ike*"                          DIALECT 2

# Fuzzy match — %term% (1 edit), %%term%% (2 edits), %%%term%%% (3 edits)
FT.SEARCH idx:bicycle "@model:%bicycle%"                      DIALECT 2

# Boolean — implicit AND (space), | OR, - NOT, ~ optional, () grouping
FT.SEARCH idx:bicycle "@type:{mountain} -@condition:{used}"   DIALECT 2
FT.SEARCH idx:bicycle "(@type:{mountain}|@type:{road}) @price:[-inf 500]" DIALECT 2

# GEO — point + radius
FT.SEARCH idx:bicycle "@store_location:[-122.4 37.7 50 km]"   DIALECT 2

# GEOSHAPE — WITHIN polygon (DIALECT 3+, but FT.CREATE marks the field)
FT.SEARCH idx:zones "@boundary:[WITHIN $poly]" PARAMS 2 poly "POLYGON((...))" DIALECT 3
```

## TAG escaping rules

These are the single biggest source of empty-result bugs. TAG values are *not* tokenized; hyphens, dots, commas, `@`, `:`, and spaces inside a tag must be escaped with a leading backslash, and the whole value lives inside `{}`.

```
# TAG with hyphen — must escape
FT.SEARCH idx:bicycle "@brand:{Giant\\-Cycles}"               DIALECT 2

# TAG with dot — must escape
FT.SEARCH idx:bicycle "@email:{user\\@example\\.com}"         DIALECT 2

# TAG with space — escape the space (or use double-quotes inside the braces)
FT.SEARCH idx:bicycle "@brand:{Trek\\ Bicycles}"              DIALECT 2

# TAG with embedded colons (FHIR-style urn:uuid:...) — escape every : and -
FT.SEARCH idx:obs "@subject:{urn\\:uuid\\:fa70e7dd\\-03aa\\-6885\\-ca29\\-c65c38dab633}" DIALECT 2
```

**TAG comparisons are case-sensitive AND require exact-value match (no substring).** Mirror the casing of values exactly as they appear in the schema's `top_values` or sample documents — Redis Search does not auto-fold TAG case and does not substring-match TAG values.

- `@Breed:{Pit}` will NOT match an indexed `@Breed:{pitbull}`. If you see `pitbull` in the sample data, query exactly `@Breed:{pitbull}` (or `@Breed:pitbull` for TEXT fields). Do not infer a more-specific or more-generic variant.
- For multi-word breeds / categories, look at the actual schema value: `Pit Bull` and `pitbull` are different values and will not match each other.

**TAG IDs (UUIDs, FHIR `urn:uuid:…`, hyphenated codes) MUST be escaped.** Every `:`, `-`, `.`, and space inside `{...}` needs a leading backslash. UUIDs almost always contain hyphens — forgetting to escape returns zero results or a syntax error.

```
# Bad: unescaped hyphens in a UUID — "Syntax error at offset 13 near ..."
FT.SEARCH explanationofbenefits "@id:{96771ad4-d132-3aa6-3a79-36a03ded158e}"

# Good: every hyphen escaped
FT.SEARCH explanationofbenefits "@id:{96771ad4\\-d132\\-3aa6\\-3a79\\-36a03ded158e}"

# Good: FHIR-style urn:uuid:... — escape every : and -
FT.SEARCH idx:obs "@subject:{urn\\:uuid\\:fa70e7dd\\-03aa\\-6885\\-ca29\\-c65c38dab633}"
```

**When the question gives you a literal ID string, the command type is FT.SEARCH** (look-up by key), and the value goes inside `{...}` with every `-`/`:`/`.` escaped.

## Multi-word TEXT — phrase vs AND-of-words

Unquoted multi-word values in a `@field:` clause split on whitespace and AND the terms *across* the index, not scoped to the field. Use `"…"` for an exact phrase or `(…)` for word-AND scoped to the field.

```
# Bad: unquoted — parses as @reason:sleep AND apnea (apnea is unfielded!)
FT.SEARCH idx:dx "@reason:sleep apnea"             DIALECT 2

# Good: exact phrase, words in order, adjacent
FT.SEARCH idx:dx "@reason:\"sleep apnea\""         DIALECT 2

# Good: both words required, any order, no adjacency constraint
FT.SEARCH idx:dx "@reason:(sleep apnea)"           DIALECT 2
```

## Dates indexed as TEXT

Hyphens are token breaks in TEXT, so an unescaped `@date:2022-07` parses as `2022 AND -07`. Escape hyphens and use a prefix wildcard for "month of" / "year of" queries; alternation lives inside `(...)`.

```
# All dates in July 2022 — escape - and use a trailing * for the day
FT.SEARCH idx:events "@date:2022\\-07*"            DIALECT 2

# Q1 2022 — alternation of escaped prefixes inside parens
FT.SEARCH idx:events "@date:(2022\\-01*|2022\\-02*|2022\\-03*)"   DIALECT 2

# Bad: unescaped hyphen — parses as 2022 AND -07
FT.SEARCH idx:events "@date:2022-07"

# Bad: per-field alternation — becomes a UNION of three different field clauses, not a date OR
FT.SEARCH idx:events "@date:2010 | @date:2011 | @date:2012"
```

**The `*` does NOT distribute across alternation — every alternative carries its own trailing `*`.** This is the single most common date-alternation bug.

```
# Bad: bare years inside alternation — matches the literal tokens "2018" / "2019", not "any date in 2018/2019"
FT.SEARCH idx:events "@date:(2018|2019)"

# Bad: hyphen-escaped but no wildcard — matches the literal "2022-01" / "2022-02" only
FT.SEARCH idx:events "@date:(2022\\-01|2022\\-02)"

# Good: every alternative gets its own trailing *
FT.SEARCH idx:events "@date:(2018*|2019*)"                        # any date in 2018 or 2019
FT.SEARCH idx:events "@date:(2022\\-01*|2022\\-02*|2022\\-03*)"   # any date in Jan/Feb/Mar 2022
```

The same alternation rule applies inside `FT.AGGREGATE` query strings — every TEXT field where you want a prefix-match disjunction, not just dates.

**Incorrect:** Using `()` for TAG values, `{}` for TEXT, forgetting to escape hyphens, or mixing delimiters.

```
# Bad: () around a TAG value — parses as a TEXT clause, returns nothing
FT.SEARCH idx:bicycle "@condition:(new)"

# Bad: unescaped hyphen in a TAG — RQE treats the dash as NOT
FT.SEARCH idx:bicycle "@brand:{Giant-Cycles}"   # returns 0 results

# Bad: NUMERIC values inside {} — silently empty
FT.SEARCH idx:bicycle "@price:{100 500}"

# Bad: parens unbalanced for numeric range — "Syntax error near +inf"
# The OUTER brackets of a numeric range are always [ ]. To make a bound
# exclusive, prefix the VALUE with ( inside the brackets.
FT.SEARCH idx:bicycle "@abv:(0.08 +inf]"

# Good: exclusive lower, inclusive upper
FT.SEARCH idx:bicycle "@abv:[(0.08 +inf]"

# Good: both bounds exclusive
FT.SEARCH idx:bicycle "@abv:[(0.08 (1.0]"
```

| Delimiter | Use | Example |
|-----------|-----|---------|
| `( )` | TEXT phrase grouping / boolean grouping | `(@type:{product} \| @type:{post})` |
| `{ }` | TAG exact-match (with `\|` for alternatives) | `@condition:{new\|refurbished}` |
| `[ ]` | NUMERIC range, GEO, GEOSHAPE, VECTOR_RANGE | `@price:[100 500]`, `@price:[-inf 200]` |
| `" "` | exact phrase match in TEXT | `"mountain bicycle"` |

## Client mirrors

```python
# redis-py — STEP_START query_syntax
# Mirrors doctests/query_ft.py + query_em.py
from redis import Redis
r = Redis()
# TAG with escaped hyphen
r.ft("idx:bicycle").search(r"@brand:{Giant\-Cycles}")
# NUMERIC range
r.ft("idx:bicycle").search("@price:[100 500]")
# Boolean: type mountain OR road, exclude used
r.ft("idx:bicycle").search("(@type:{mountain}|@type:{road}) -@condition:{used}")
# STEP_END
```

```java
// Jedis — STEP_START query_syntax
// Mirrors QueryFtExample.java + QueryEmExample.java
import redis.clients.jedis.UnifiedJedis;
import redis.clients.jedis.search.Query;
try (UnifiedJedis jedis = new UnifiedJedis("redis://localhost:6379")) {
    // TAG with escaped hyphen — note Java requires double-escaping the backslash
    jedis.ftSearch("idx:bicycle", new Query("@brand:{Giant\\-Cycles}"));
    jedis.ftSearch("idx:bicycle", new Query("@price:[100 500]"));
    jedis.ftSearch("idx:bicycle",
        new Query("(@type:{mountain}|@type:{road}) -@condition:{used}"));
}
// STEP_END
```

## Upstream sources

- redis-py: [`doctests/query_ft.py`](https://github.com/redis/redis-py/blob/master/doctests/query_ft.py), [`query_em.py`](https://github.com/redis/redis-py/blob/master/doctests/query_em.py), [`query_geo.py`](https://github.com/redis/redis-py/blob/master/doctests/query_geo.py), [`query_range.py`](https://github.com/redis/redis-py/blob/master/doctests/query_range.py)
- Jedis: [`QueryFtExample.java`](https://github.com/redis/jedis/blob/master/src/test/java/io/redis/examples/QueryFtExample.java), [`QueryEmExample.java`](https://github.com/redis/jedis/blob/master/src/test/java/io/redis/examples/QueryEmExample.java), [`QueryGeoExample.java`](https://github.com/redis/jedis/blob/master/src/test/java/io/redis/examples/QueryGeoExample.java)
- Reference: [Query Syntax](https://redis.io/docs/latest/develop/interact/search-and-query/query/), [Escaping](https://redis.io/docs/latest/develop/interact/search-and-query/query/#tokenization)

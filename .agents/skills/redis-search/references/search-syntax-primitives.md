# Redis Search Query Syntax Primitives

This reference is the canonical vocabulary for the Redis Search query DSL. Action-oriented references ([query-syntax.md](query-syntax.md), [vector-query.md](vector-query.md), [aggregate-pipeline.md](aggregate-pipeline.md), etc.) link here by anchor instead of redefining terms — read this once to anchor terminology, then use the rest for "how to do X."

The terms below describe what Redis Search understands when it parses the query string passed to `FT.SEARCH`, `FT.AGGREGATE`, or `FT.HYBRID`.

## Query Expression
<a id="query-expression"></a>

The complete text input submitted to Redis Search that defines the search criteria — terms, fields, operators, and modifiers combined to retrieve relevant documents.

```
"hello world @category:{electronics} @price:[100 500]"
```

## Query Term
<a id="query-term"></a>

A single word or phrase that represents a discrete unit of search. Terms can be simple words, quoted phrases, prefixes with wildcards, fuzzy matches, or vector clauses. The canonical shape of a query term is **field identifier → delimiter → term**.

```
smartphone
@description:wireless
@category:{ele*}
```

## Field Identifier
<a id="field-identifier"></a>

A prefix that scopes a query term to a specific indexed field. Without a field identifier, Redis Search searches across all TEXT fields. The syntax is `@<alias>:` where `<alias>` is the field name (or `AS` alias for JSON paths).

```
@description:wireless
@category:{electronics}
@price:[100 500]
```

## Query Delimiters
<a id="query-delimiters"></a>

The bracket type tells Redis Search what kind of match to perform — **this is the single most common source of "empty result" bugs**.

| Delimiter | Use | Example |
|-----------|-----|---------|
| `( )` | TEXT phrase / boolean grouping | `(@type:{product} \| @type:{post})` |
| `{ }` | TAG exact-match (with `\|` for alternatives) | `@category:{electronics\|books}` |
| `[ ]` | NUMERIC range, GEO, GEOSHAPE, VECTOR_RANGE | `@price:[100 500]`, `@price:[-inf 200]` |
| `" "` | exact phrase match in TEXT | `"red shoes"` |

Putting `()` around a TAG value or `{}` around a NUMERIC value silently returns zero results.

## Query Attributes
<a id="query-attributes"></a>

Modifiers attached to a term or group via the `=> { $key: value; ... }` form. They include text-search modifiers like `$weight`, `$slop`, and `$inorder`, and the vector-query attribute form `=>[KNN k @field $vec AS score]`.

```
(foo bar) => { $weight: 2.0; $slop: 1; $inorder: false }
*=>[KNN 10 @embedding $vec AS score]
```

## Weight
<a id="weight"></a>

A multiplier applied to a term or group of terms to increase their contribution to the document's relevance score. Higher weight = more influence.

```
(foo bar) => { $weight: 2.0 }
```

Field-level weight is set at index time via `TEXT WEIGHT n`; query-level weight overrides per-query.

## Scoring
<a id="scoring"></a>

The numerical calculation that assigns a relevance value to each document based on how well it matches the query. Scoring combines factors like term frequency, inverse document frequency (BM25 or TFIDF), field weights, and explicit boosts.

The default scorer is BM25 on Redis 8 (TFIDF historically). Use `WITHSCORES` to return the score per result.

## Ranking
<a id="ranking"></a>

The ordering of search results by their scores. Scoring is the math; ranking is the application of that math to determine output order. By default `FT.SEARCH` returns documents ranked by descending score.

## Sorting
<a id="sorting"></a>

Explicit ordering by a field value rather than relevance, specified with `SORTBY <field> [ASC|DESC]`. To use `SORTBY` efficiently the field must be declared `SORTABLE` at index time; otherwise Redis Search falls back to an in-page sort.

## Grouping
<a id="grouping"></a>

The process of collecting documents that share field values, implemented in `FT.AGGREGATE` via `GROUPBY n @f1 @f2 ... REDUCE <fn> ... AS <alias>`. Reducers include `COUNT`, `COUNT_DISTINCT`, `SUM`, `AVG`, `MIN`, `MAX`, `STDDEV`, `QUANTILE`, `TOLIST`, `FIRST_VALUE`, `RANDOM_SAMPLE`.

## Similarity
<a id="similarity"></a>

The degree of approximate matching allowed:

- **Fuzzy text** — `%term%` (Levenshtein distance 1), `%%term%%` (distance 2), `%%%term%%%` (distance 3).
- **Phonetic** — `PHONETIC <matcher>` on a TEXT field at index time enables sound-alike matching (e.g., `smyth` ↔ `Smith`).
- **Vector** — distance between embeddings under `COSINE`, `L2`, or `IP` metric, queried with `=>[KNN ...]` or `[VECTOR_RANGE ...]`.

## Filtering
<a id="filtering"></a>

Narrowing the candidate set by NUMERIC, TAG, or GEO criteria rather than text relevance. Filtering happens in the query expression itself (the left side of a query like `(@type:{mountain} @price:[100 500])=>[KNN ...]`) and prunes documents *before* the more expensive scoring stages.

```
@price:[-inf 200]               # numeric range
@brand:{Velorim|Trek}           # tag membership
@store_location:[-122.4 37.7 50 km]   # geo radius
```

## Operators
<a id="operators"></a>

Operators combine multiple query terms in a single expression:

| Operator | Symbol | Meaning |
|----------|--------|---------|
| AND | space (implicit) | all terms must match |
| OR | `\|` | any term matches |
| NOT | `-` (prefix) | exclude documents containing the term |
| OPTIONAL | `~` (prefix) | optional; contributes to score when present |

```
@type:{mountain} -@condition:{used}                    # AND, with negation
@brand:{Velorim} | @brand:{Trek}                        # OR
(@type:{mountain}|@type:{road}) @price:[-inf 500]      # grouped boolean
~"trail riding"                                         # optional phrase, boosts score
```

**The `@` prefix is also required after operators in `FT.AGGREGATE` pipeline stages** — every field reference inside `LOAD`, `GROUPBY`, `SORTBY`, `APPLY`, and `FILTER` starts with `@`, including inside expressions like `@field >= 5` or `substr(@date, 0, 4)`. The `@` is part of the field token, not just a query-expression marker.

## Cross-references

- Operator-by-operator with escaping rules: [query-syntax.md](query-syntax.md)
- Vector-query attribute form: [vector-query.md](vector-query.md)
- Aggregate pipeline stages: [aggregate-pipeline.md](aggregate-pipeline.md)
- Tokenization, stemming, stopwords: [text-tokenization.md](text-tokenization.md)
- Result shaping (`RETURN`, `SORTBY`, `HIGHLIGHT`, `SUMMARIZE`): [result-shaping.md](result-shaping.md)

Reference: [Query Syntax](https://redis.io/docs/latest/develop/interact/search-and-query/query/), [Aggregations](https://redis.io/docs/latest/develop/interact/search-and-query/advanced-concepts/aggregations/)

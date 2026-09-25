# Control Tokenization with NOSTEM, LANGUAGE, STOPWORDS, PHONETIC

TEXT fields are tokenized, stemmed, and stopword-filtered at index time. Defaults work for English prose, but they silently drop matches when you index product SKUs, code identifiers, or non-English text. Tokenization is the most common reason `FT.EXPLAIN` shows a token expansion you didn't expect.

**Correct:** Pick tokenization options per field, based on the kind of text in it.

```
# A schema mixing prose, identifiers, and a non-English field
FT.CREATE idx:bicycle ON HASH PREFIX 1 bicycle:
    SCHEMA
        # Prose — stem so "running" matches "run"
        description    TEXT WEIGHT 1.0
        # Model codes — don't stem, don't tokenize aggressively
        model          TEXT NOSTEM
        # Brand name — boost it in scoring
        brand          TEXT WEIGHT 3.0
        # Phonetic match for misspellings ("smyth" → "Smith")
        owner_name     TEXT PHONETIC dm:en

# Index-wide options
FT.CREATE idx:bicycle_de ON HASH PREFIX 1 bicycle:
    LANGUAGE german                              # default stemmer for all TEXT fields
    STOPWORDS 3 der die und                      # custom stopword list (0 disables)
    SCHEMA
        description TEXT
```

## Option reference

| Option | Scope | Effect |
|--------|-------|--------|
| `NOSTEM` | per TEXT field | Skip stemming. Use for SKUs, model codes, identifiers — anything where `running` ≠ `run`. |
| `WEIGHT n` | per TEXT field | Multiplier on TF/IDF contribution. Default 1.0; raise for high-signal fields like `title` or `brand`. |
| `LANGUAGE <lang>` | index-wide (or per-doc) | Selects the stemmer. Defaults to `english`. Supported: english, arabic, chinese, danish, dutch, finnish, french, german, hungarian, italian, norwegian, portuguese, romanian, russian, spanish, swedish, tamil, turkish. |
| `STOPWORDS n w1 w2 ...` | index-wide | Override the default English stopword list. `STOPWORDS 0` disables stopword removal entirely (necessary when stopwords are meaningful in your domain, e.g., `"to be"`). |
| `PHONETIC <matcher>` | per TEXT field | Index phonetic codes for fuzzy-name matching. Matchers: `dm:en` (English), `dm:fr`, `dm:pt`, `dm:es`. |

## Diagnose tokenization with `FT.EXPLAIN`

```
FT.EXPLAIN idx:bicycle "running shoes"
# → INTERSECT { UNION{run, running} UNION{shoe, shoes} }
# Stemming is expanding the terms. If "running" should be literal, mark the field NOSTEM.
```

**Incorrect:** Using TEXT for identifiers (loses recall on SKUs), forgetting to disable stopwords for short queries that include them, or setting LANGUAGE on the wrong layer.

```
# Bad: SKU as TEXT without NOSTEM — "BIKE-2024" gets tokenized + stemmed
FT.CREATE idx:bicycle ON HASH PREFIX 1 bicycle:
    SCHEMA
        sku TEXT                          # use NOSTEM, or use TAG

# Bad: querying "to be" against an index with default stopwords
FT.SEARCH idx:books "to be or not to be"
# → effectively searches "" — every stopword is dropped.

# Bad: putting LANGUAGE on a single field — it is an index-wide option
FT.CREATE idx:bicycle ON HASH
    SCHEMA description TEXT LANGUAGE french      # this is rejected
```

## Choosing TEXT vs TAG

- TEXT: prose, descriptions, anything users type into a search box.
- TAG: identifiers, categories, statuses, anything where exact match is what you want and tokenization is harmful.
- A SKU like `BIKE-2024-XL` is almost always better as TAG.

## Client mirrors

```python
# redis-py — STEP_START tokenization
from redis import Redis
from redis.commands.search.field import TextField, TagField
r = Redis()
schema = (
    TextField("description"),
    TextField("model", no_stem=True),
    TextField("brand", weight=3.0),
    TextField("owner_name", phonetic_matcher="dm:en"),
    TagField("sku"),                              # SKU as TAG, not stemmed TEXT
)
r.ft("idx:bicycle").create_index(schema)
# STEP_END
```

```java
// Jedis — STEP_START tokenization
import redis.clients.jedis.UnifiedJedis;
import redis.clients.jedis.search.FTCreateParams;
import redis.clients.jedis.search.schemafields.*;

try (UnifiedJedis jedis = new UnifiedJedis("redis://localhost:6379")) {
    jedis.ftCreate("idx:bicycle",
        FTCreateParams.createParams(),
        TextField.of("description"),
        TextField.of("model").noStem(),
        TextField.of("brand").weight(3.0),
        TextField.of("owner_name").phonetic("dm:en"),
        TagField.of("sku"));
}
// STEP_END
```

## Upstream sources

- No direct upstream example — authored from official Redis Search command and tokenization documentation.
- Reference: [Stemming](https://redis.io/docs/latest/develop/interact/search-and-query/advanced-concepts/stemming/), [Stopwords](https://redis.io/docs/latest/develop/interact/search-and-query/advanced-concepts/stopwords/), [Phonetic Matching](https://redis.io/docs/latest/develop/interact/search-and-query/advanced-concepts/phonetic_matching/)

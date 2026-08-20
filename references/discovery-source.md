# Discovery source

The Discovery refresh uses the public Hacker News Search API powered by Algolia.

Source: https://hn.algolia.com/api

Relevant documented endpoints and fields:

- `GET https://hn.algolia.com/api/v1/search_by_date`
- Query parameters used: `query`, `tags=story`, `hitsPerPage`, and `numericFilters=created_at_i>...`.
- Candidate fields used: `objectID`, `title`, `url`, `points`, `num_comments`, and `created_at_i`.
- Stories without an HTTPS URL fall back to `https://news.ycombinator.com/item?id=<objectID>`.
- The API documentation states that requests are rate-limited to 10,000 requests per hour per IP; this application makes one request per scheduled refresh and uses the project's secure external HTTP client.

Implementation note: Discovery stores a stable `sourceKey` (`hn:<objectID>`) and updates an existing record rather than inserting duplicates. The daily callback is mounted at `/api/scheduled/discovery-refresh` and resolves its owner by Heartbeat `taskUid`.

# GitHub Discovery source

The second Discovery source will use GitHub's public REST Search repositories endpoint:

`GET https://api.github.com/search/repositories?q=<query>&sort=updated&order=desc&per_page=25`

Official documentation: https://docs.github.com/en/rest/search/search?apiVersion=2026-03-10

The API supports repository search qualifiers such as keywords, `created:>YYYY-MM-DD`, `stars:>N`, and `language:...`. Search results expose `id`, `full_name`, `html_url`, `description`, `stargazers_count`, `forks_count`, `open_issues_count`, `language`, and `updated_at`, which are sufficient to create market signals.

Rate-limit note: GitHub documents a dedicated unauthenticated search limit of 10 requests per minute for search endpoints, while the general unauthenticated REST limit is 60 requests per hour. The implementation will make one request per user refresh, use the shared secure external HTTP client, set the recommended `Accept: application/vnd.github+json` header, and avoid retrying rate-limit responses.

Official rate-limit documentation: https://docs.github.com/rest/using-the-rest-api/rate-limits-for-the-rest-api

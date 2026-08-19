# Codex / ChatGPT authentication findings

## Official sources

- https://learn.chatgpt.com/docs/auth
- https://developers.openai.com/plugins/build/auth
- https://developers.openai.com/api/reference/overview

## Findings

The official ChatGPT/Codex authentication documentation describes ChatGPT sign-in and API-key sign-in for local Codex clients such as the desktop app, CLI, and IDE extension. It does not document a general public OAuth flow that an arbitrary external web application can use as a replacement for OpenAI API credentials.

The OpenAI API reference documents bearer authentication with an API key or short-lived workload identity access token for programmatic API requests, and warns that API keys must remain server-side and must not be exposed in browser or app code.

OpenAI's OAuth documentation is primarily for authenticated ChatGPT/Codex clients connecting to a developer-owned MCP server. That flow requires a protected-resource metadata endpoint, OAuth authorization-server discovery, PKCE with S256, resource propagation, issuer validation, and an authorized callback. It is not the same as using ChatGPT subscription login as a generic model-provider credential for an external application.

## Design decision

The product should show ChatGPT/Codex as a provider option with a clear distinction: API-key mode can be implemented securely server-side; direct generic ChatGPT subscription OAuth should not be faked or implemented without an officially supported client/application flow and required provider credentials. A future OAuth connection is appropriate if the user supplies an official client registration and the provider explicitly supports this use case. For the current prototype, expose the provider card and explain the limitation rather than storing or collecting unsupported tokens.

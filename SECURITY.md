# Security Policy

## Supported versions

The current GitHub Pages deployment and the latest `0.1.x` release receive security fixes. Older development snapshots are not supported.

## Reporting a vulnerability

Do not publish exploit details, private logs, player or guild names, local paths, VOD content, project files, exported media, credentials, or other sensitive data in a public issue.

Use GitHub private vulnerability reporting from the repository's **Security** tab when it is available. If that option is unavailable, open a minimal public issue titled `Private security report requested` without technical details or sensitive data so the maintainer can arrange a private follow-up channel.

Include only the information needed to reproduce and assess the issue:

- A concise description of the impact
- Affected app version and browser version
- Privacy-safe reproduction steps using synthetic data
- The affected capability, codec, or file-size range when relevant
- Suggested mitigation, if known

You can expect an initial acknowledgement when the maintainer reviews the report. Disclosure timing and remediation will be coordinated before technical details are made public.

## Scope

Security issues include unintended uploads or network requests, exposure of local content or paths, unsafe handling of imported files, path traversal, script injection, permission misuse, dependency vulnerabilities with a practical impact, and destructive persistence or export behavior.

Ordinary bugs and feature requests should use the public issue templates.

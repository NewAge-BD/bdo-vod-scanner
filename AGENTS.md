# AGENTS.md

## Purpose

This file defines the durable working rules for Codex and other coding agents in the BDO VOD Scanner repository. Product requirements live in `docs/MASTER_PROMPT.md`; do not duplicate or silently override them here.

## Language

- Communicate with the user in the language they use.
- Write code, identifiers, comments, technical documentation, and commit messages in English.

## Working method

1. Read this file and the relevant sections of `docs/MASTER_PROMPT.md` before changing the project.
2. Inspect the working tree and preserve unrelated user changes.
3. Present a short plan before substantial features or architecture changes.
4. Implement small, unambiguous changes directly.
5. Make only small, low-risk assumptions consistent with documented requirements.
6. Keep changes focused and update affected documentation.
7. Run the required checks before declaring completion.
8. Create a local Conventional Commit after a completed task when the repository is initialized and all required checks pass.
9. Never push, publish, release, or deploy without explicit approval.

## Approval required

Ask before:

- Adding a dependency. Explain its purpose, alternatives, license, maintenance status, bundle-size impact, and risks.
- Performing a major dependency upgrade.
- Adding an external service, backend, cloud feature, telemetry, authentication, or secret.
- Making a major architecture decision or breaking change.
- Removing compatibility for a released project-file version.
- Running a destructive or potentially data-losing migration.
- Deleting files not clearly owned by the current task.
- Changing a documented privacy or security guarantee.
- Making the repository public, choosing a license, pushing, publishing, releasing, or deploying.
- Starting the Windows desktop implementation or AI event recognition.

## Allowed autonomy

Agents may:

- Make small implementation decisions.
- Refactor directly affected code without changing promised behavior.
- Fix a small, clearly related bug found during the task.
- Add or update tests and documentation.
- Create non-destructive local-data migrations.
- Apply compatible dependency updates after verification.
- Create local feature branches.
- Adjust build or CI configuration within task scope if no new secret, paid service, or external system is introduced.
- Delete obsolete project-owned files when their removal is an obvious part of the task.
- Change internal interfaces and update every caller.

## Engineering rules

- Use strict TypeScript and avoid `any`.
- Prefer clear code over clever code.
- Keep domain logic independent of React where practical.
- Validate every untrusted file and imported value at a boundary.
- Never load an entire large VOD into memory or browser storage.
- Keep browser, persistence, and media implementations behind explicit adapters.
- Keep experimental export code isolated from stable project and timeline logic.
- Avoid unnecessary abstractions, dependencies, large components, giant stores, and unrelated edits.
- Preserve backward compatibility of released portable project formats through explicit migrations.
- Never commit real logs, player or guild data, local paths, VODs, secrets, browser databases, or generated media exports.

## Required checks

Run all checks relevant to the change:

- Formatter
- Linter
- Typecheck
- Unit and integration tests
- Chromium smoke tests for affected central workflows
- Production build

If a check cannot run, say why. Do not represent critical unfinished work as complete.

## Definition of Done

A task is complete only when:

- Requested behavior works and relevant edge cases are handled.
- Errors are understandable and privacy/security rules remain intact.
- Accessibility implications are addressed.
- Relevant checks pass or unavoidable omissions are disclosed.
- Documentation is current.
- No sensitive, generated, or unrelated data is included.
- Known limitations and TODOs are recorded.
- A local Conventional Commit is created when Git is available.

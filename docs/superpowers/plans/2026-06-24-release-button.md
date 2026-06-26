# ForgeDesk In-App Release Publishing

## Goal

Add an in-app release publishing flow next to Git commit actions so a user can prepare version metadata with AI, validate release readiness, and run the project's configured macOS publish script from ForgeDesk.

## Scope

- Add deterministic release planning helpers for semantic version bumps, tag names, and tag conflict guidance.
- Add main-process IPC for release preparation, AI-assisted metadata suggestions, and publish execution.
- Add renderer types and a release modal available from commit surfaces.
- Keep AI limited to filling release metadata; packaging and publishing must follow the repository's package.json scripts and existing project config.
- Verify with focused unit tests plus the existing test/type-check flow.

## Checkpoints

1. Write failing tests for version/tag/release view behavior.
2. Implement helper modules and AI release assistant.
3. Wire main IPC and preload bridge.
4. Add the release modal and buttons beside commit actions.
5. Run verification and report any remaining limits.

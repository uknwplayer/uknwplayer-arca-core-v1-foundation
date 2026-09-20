# Mega Brain Federation Dispatch — Operator B v0.1

This branch extends the existing explicit-trust A↔B federation proof with one additional closed action:

`mega-brain.dispatch`

The action does not accept arbitrary commands. It accepts only an `arca-mega-brain-task-v1` object with exact fields and returns a bounded `arca-mega-brain-dispatch-result-v1` inside the existing signed federation result/evidence flow.

Existing `worker.ping` behavior remains unchanged.

## Trust and execution boundary

- origin must remain `arca-federation-operator-a`;
- target must remain `arca-federation-operator-b`;
- incoming statement must verify against the pinned Operator A identity;
- action is allowlisted;
- task fields are exact and bounded;
- no shell/action name may be smuggled inside task params;
- result mission/task/node bindings are verified;
- Operator B signs canonical `accepted` and `completed` evidence with its existing operational Ed25519 identity.

## Live branch probe

The dedicated workflow on this branch processes signed inbox statements without requiring this candidate to be merged to `main`. This keeps the test review-gated while exercising a real independent repository/runtime.

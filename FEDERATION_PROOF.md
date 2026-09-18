# Live Federation Proof — Operator B

## Goal

Prove that two project-owned, repository-independent Machine Bridge operators can exchange ownership-bound evidence without collapsing trust, execution, and reconciliation boundaries.

## Required gates

1. Operator A explicitly trusts Operator B identity.
2. Operator B explicitly trusts only the expected Operator A identity for the probe.
3. Requests and evidence are signed and ownership-bound.
4. Replay of an already consumed request/evidence fails closed or is idempotent.
5. No arbitrary shell or natural-language-to-execution path is introduced.
6. Remote acceptance is not treated as completion.
7. Completion is reconciled at origin only from verified remote evidence/result hash.
8. Missing/timeout evidence never proves non-execution.
9. Remote rejection never triggers automatic cross-peer failover.
10. The first probe uses a bounded non-destructive capability (worker.ping/equivalent).

## Evidence to preserve

- A request/probe identifier and hashes, not private payloads;
- selected Operator B identity;
- accepted/rejected/completed signed evidence;
- origin reconciliation result;
- CI/run identifiers relevant to the proof;
- replay/idempotency outcome.

## Current state

Operator B surface initialized. Deployment/runtime transport is not yet installed. No live federation claim may be made until all gates above are exercised across the repository boundary.

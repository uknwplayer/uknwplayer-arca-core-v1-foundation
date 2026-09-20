# Federated Vince Node v0.1 — Public Gateway / Private Executor

Operator B is intentionally public. Vince Negra is private.

GitHub does not allow a public workflow to consume a private action, so the integration uses a two-phase delegation protocol instead of exposing Vince.

## Phase 1 — authorization

1. Operator A signs a `mega-brain.dispatch` request assigned to `node.vince`.
2. Public Operator B verifies A against pinned trust.
3. B validates the closed Mega Brain task and allowed Vince capabilities.
4. B signs canonical `accepted` evidence.
5. B persists `arca-federated-vince-authorization-v1`.

## Phase 2 — private cognition and completion

1. Private Operator A verifies B's signed acceptance.
2. A executes the private Vince action.
3. A signs a second `mega-brain.result.submit` statement binding:
   - original request/job;
   - original payload hash;
   - original owner binding;
   - B's accepted statement hash;
   - Vince's closed result.
4. B verifies the signed result submission.
5. B revalidates the result against the original task and requires a `vince://cognitive-trace/` evidence source.
6. B signs canonical `completed` evidence bound to the exact result hash.
7. A verifies B and reconciles original ownership to completed.

At no point does the public B repository receive Vince source code or credentials.

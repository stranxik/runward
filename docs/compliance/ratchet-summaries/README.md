# Ratchet summaries

One file per release, `ratchet-summary-X.Y.Z.json`: the signed summary of the mutation ratchet that
release's publication started ([ADR-0079](../../adr/ADR-0079-a-release-keeps-a-signed-summary-of-its-mutation-ratchet.md)).
It is signed hours after the release is published, so it cannot be attached to an immutable release;
the maintainer commits it here, byte for byte as the ratchet's `summary` job produced it, in the next
release pull request, and the release notes carry its SHA-256 and path
([ADR-0085](../../adr/ADR-0085-the-release-chain-publishes-a-draft-first-then-makes-it-immutable.md), Decision 7).

**The proof is the attestation, not the commit.** A file in this directory is only a copy anyone with
write access could have placed. What makes it evidence is the GitHub artifact attestation the
ratchet workflow signed for its digest, which only `mutation-ratchet.yml` can produce:

```sh
gh attestation verify docs/compliance/ratchet-summaries/ratchet-summary-X.Y.Z.json \
  --repo stranxik/runward \
  --signer-workflow stranxik/runward/.github/workflows/mutation-ratchet.yml
```

Exit 0 means the file is the one the ratchet run signed. A file changed by a single byte has another
digest, finds no attestation, and fails. What a summary means, and what it does not prove, is in
`docs/verifying-a-release.md`, Step 6.

| File | Release | SHA-256 |
|---|---|---|
| `ratchet-summary-0.42.3.json` | v0.42.3 | `a908046d2c53d206ab690945d48dd1dfb537aebe05a8536a67c8a8c563353555` |
| `ratchet-summary-0.43.0.json` | v0.43.0 | `330e3ba3e05aa512c68dbeaa49a4974bc8589069eb29ca3f12d36b6e68e95739` |

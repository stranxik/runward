# runward-forge 0.0.0-bootstrap.0 (placeholder)

This version is a placeholder. It contains no code: only this file and its `package.json`.

npm trusted publishing can only be configured on a package that already exists on the registry, so
the maintainer published this placeholder once, by hand, under the dist-tag `bootstrap`, to create
the package `runward-forge` and attach to it the trusted publisher of the runward release workflow
(`stranxik/runward`, `.github/workflows/release.yml`). It is deprecated.

Every real version of `runward-forge` is released with `runward`, at the same version, from the same
tag, packed and attested by the isolated builder and published with provenance by the release
workflow: <https://github.com/stranxik/runward/tree/main/packages/runward-forge>.

The procedure is `runward/runbook.md` §3.1 in the repository.

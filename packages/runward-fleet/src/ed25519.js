// A detached Ed25519 signature over a manifest that names a repository, a commit, a ref and the
// digests of the files it covers. This is how a CI that holds a dedicated key signs its evidence
// when the keyless route is not open to it (a private repository, no public transparency log): the
// real case is the evidence folder a CI writes as `manifeste.json` and `manifeste.sig`, the schema
// `dropyour.preuves-ci.v2`.
//
// What a key proves, said wherever its result is shown: the holder of the key signed these bytes.
// It does not name the workflow that used the key, so the trust policy pins the key itself, the
// repositories it may sign for and the protected ref, and the page says "a key names its holder,
// not the workflow".
import { createHash, createPublicKey, verify as cryptoVerify } from "node:crypto";

/** Manifest schemas this version reads, each mapped to the four claims and the file list. */
export const MANIFEST_FORMATS = {
  "dropyour.preuves-ci.v2": (doc) => {
    if (doc?.schema !== "dropyour.preuves-ci.v2") return null;
    const ok = ["depot", "commit", "ref", "run"].every((k) => typeof doc[k] === "string") && Array.isArray(doc.fichiers)
      && doc.fichiers.every((f) => f && typeof f.chemin === "string" && /^[0-9a-f]{64}$/.test(String(f.sha256)));
    if (!ok) return null;
    return {
      repository: `github.com/${doc.depot}`,
      commit: doc.commit,
      ref: doc.ref,
      run: doc.run,
      files: doc.fichiers.map((f) => ({ path: f.chemin, sha256: f.sha256 })),
    };
  },
};

/** Read an Ed25519 public key from PEM (SPKI) or a JWK; returns the key and the sha256 of its SPKI. */
export function readEd25519Key(material) {
  const key = typeof material === "string"
    ? createPublicKey(material)
    : createPublicKey({ key: material, format: "jwk" });
  if (key.asymmetricKeyType !== "ed25519") throw new Error(`a ${key.asymmetricKeyType ?? "unknown"} key, Ed25519 expected`);
  const digest = createHash("sha256").update(key.export({ type: "spki", format: "der" })).digest("hex");
  return { key, digest: `sha256:${digest}` };
}

/** True only when `sigText` (base64) is an Ed25519 signature of exactly `bytes` under `key`. */
export function ed25519Verifies(bytes, sigText, key) {
  try {
    const t = String(sigText ?? "").trim();
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(t)) return false;
    return cryptoVerify(null, bytes, key, Buffer.from(t, "base64"));
  } catch {
    return false;
  }
}

/**
 * Read a signed manifest: which candidate key (if any) verifies it, and what it claims.
 * `keys` are the policy's keys ({ id, key, digest }); `claimed` an optional key shipped with the
 * export, used only to tell a key outside the policy apart from a falsified manifest, never to raise.
 */
export function readSignedManifest({ manifest, signature, format, keys, claimed }) {
  const out = { verifiedBy: null, claimedVerifies: false, claims: null, reason: null };
  const parse = MANIFEST_FORMATS[format];
  if (!parse) { out.reason = `manifest format ${JSON.stringify(format)} is not one this version reads`; return out; }
  if (signature === null) { out.reason = "no signature file"; return out; }
  for (const k of keys) {
    if (ed25519Verifies(manifest, signature, k.key)) { out.verifiedBy = k; break; }
  }
  if (!out.verifiedBy && claimed) out.claimedVerifies = ed25519Verifies(manifest, signature, claimed.key);
  try {
    out.claims = parse(JSON.parse(manifest.toString("utf8")));
  } catch {
    out.claims = null;
  }
  if (!out.claims) out.reason = `the manifest is not a ${format} document`;
  return out;
}

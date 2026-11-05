// A Sigstore of the test's own: a certificate authority, a transparency log and the bundles they
// produce, made in memory with keys generated at each run. Nothing here is committed key material,
// and nothing reaches a network. It lets the fleet tests sign what a CI on `refs/heads/main` would
// sign, which no real bundle of this repository does (its releases are signed on tags), and plant
// every falsification the verifier must refuse.
import { createHash, generateKeyPairSync, sign } from "node:crypto";

// ---- DER, written by hand: just what a certificate needs
const len = (n) => (n < 0x80 ? Buffer.from([n]) : n < 0x100 ? Buffer.from([0x81, n]) : n < 0x10000 ? Buffer.from([0x82, n >> 8, n & 0xff]) : Buffer.from([0x83, n >> 16, (n >> 8) & 0xff, n & 0xff]));
const tlv = (tag, ...parts) => { const v = Buffer.concat(parts); return Buffer.concat([Buffer.from([tag]), len(v.length), v]); };
const seq = (...p) => tlv(0x30, ...p);
const set = (...p) => tlv(0x31, ...p);
const octet = (b) => tlv(0x04, b);
const utf8 = (s) => tlv(0x0c, Buffer.from(s, "utf8"));
const bool = (v) => tlv(0x01, Buffer.from([v ? 0xff : 0]));
const int = (n) => { let h = BigInt(n).toString(16); if (h.length % 2) h = `0${h}`; let b = Buffer.from(h, "hex"); if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0]), b]); return tlv(0x02, b); };
function oid(dotted) {
  const p = dotted.split(".").map(Number);
  const out = [40 * p[0] + p[1]];
  for (const n of p.slice(2)) {
    const g = [];
    let x = n;
    do { g.unshift(x & 0x7f); x = Math.floor(x / 128); } while (x > 0);
    for (let i = 0; i < g.length - 1; i++) g[i] |= 0x80;
    out.push(...g);
  }
  return tlv(0x06, Buffer.from(out));
}
const utc = (ms) => {
  const d = new Date(ms);
  const p = (x) => String(x).padStart(2, "0");
  return tlv(0x17, Buffer.from(`${p(d.getUTCFullYear() % 100)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`));
};
const name = (cn) => seq(set(seq(oid("2.5.4.10"), utf8("fleet-test.invalid"))), set(seq(oid("2.5.4.3"), utf8(cn))));
const ext = (id, value, critical = false) => seq(oid(id), ...(critical ? [bool(true)] : []), octet(value));
const ECDSA_SHA256 = seq(oid("1.2.840.10045.4.3.2"));
const ECDSA_SHA384 = seq(oid("1.2.840.10045.4.3.3"));
const spki = (pub) => pub.export({ type: "spki", format: "der" });
const keyId = (pub) => createHash("sha1").update(spki(pub)).digest();

function certificate({ serial, issuer, subject, notBefore, notAfter, pub, extensions, signer, alg = ECDSA_SHA384, hash = "sha384" }) {
  const tbs = seq(tlv(0xa0, int(2)), int(serial), alg, issuer, seq(utc(notBefore), utc(notAfter)), subject, spki(pub), tlv(0xa3, seq(...extensions)));
  const sig = sign(hash, tbs, signer);
  return seq(tbs, alg, tlv(0x03, Buffer.from([0]), sig));
}

const FULCIO = "1.3.6.1.4.1.57264.1.";
const at = Date.UTC(2026, 10, 1, 10, 0, 0); // the integrated time every synthetic entry carries
export const SIGNED_AT = at;

/** A certificate authority (root and intermediate) and a log, with a trusted root that lists them. */
export function makeSigstore() {
  const root = generateKeyPairSync("ec", { namedCurve: "secp384r1" });
  const inter = generateKeyPairSync("ec", { namedCurve: "secp384r1" });
  const log = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const caExt = (pub, issuerPub) => [
    ext("2.5.29.15", tlv(0x03, Buffer.from([1, 0x06])), true),
    ext("2.5.29.19", seq(bool(true)), true),
    ext("2.5.29.14", octet(keyId(pub))),
    ...(issuerPub ? [ext("2.5.29.35", seq(tlv(0x80, keyId(issuerPub))))] : []),
  ];
  const nb = Date.UTC(2026, 0, 1), na = Date.UTC(2036, 0, 1);
  const rootDer = certificate({ serial: 1, issuer: name("fleet-test-root"), subject: name("fleet-test-root"), notBefore: nb, notAfter: na, pub: root.publicKey, extensions: caExt(root.publicKey), signer: root.privateKey });
  const interDer = certificate({ serial: 2, issuer: name("fleet-test-root"), subject: name("fleet-test-intermediate"), notBefore: nb, notAfter: na, pub: inter.publicKey, extensions: caExt(inter.publicKey, root.publicKey), signer: root.privateKey });
  const logId = createHash("sha256").update(spki(log.publicKey)).digest();
  const trustedRoot = {
    mediaType: "application/vnd.dev.sigstore.trustedroot+json;version=0.1",
    tlogs: [{ baseUrl: "https://rekor.fleet-test.invalid", hashAlgorithm: "SHA2_256", publicKey: { rawBytes: spki(log.publicKey).toString("base64"), keyDetails: "PKIX_ECDSA_P256_SHA_256", validFor: { start: "2026-01-01T00:00:00Z" } }, logId: { keyId: logId.toString("base64") } }],
    certificateAuthorities: [{ subject: { organization: "fleet-test.invalid", commonName: "fleet-test" }, uri: "https://fulcio.fleet-test.invalid", certChain: { certificates: [{ rawBytes: interDer.toString("base64") }, { rawBytes: rootDer.toString("base64") }] }, validFor: { start: "2026-01-01T00:00:00Z" } }],
    ctlogs: [],
    timestampAuthorities: [],
  };
  return { trustedRoot, inter, log, logId, interDer };
}

/** The identity GitHub Actions gives a workflow on a ref, as Fulcio writes it. */
export function githubIdentity({ repo = "example/app", workflow = ".github/workflows/fleet-sign.yml", ref = "refs/heads/main", commit = "a".repeat(40), workflowDigest, runner = "github-hosted" } = {}) {
  const signer = `https://github.com/${repo}/${workflow}@${ref}`;
  return {
    san: signer,
    claims: {
      8: "https://token.actions.githubusercontent.com", 9: signer, 10: workflowDigest ?? commit, 11: runner,
      12: `https://github.com/${repo}`, 13: commit, 14: ref, 18: signer, 19: workflowDigest ?? commit, 20: "push",
      21: `https://github.com/${repo}/actions/runs/1/attempts/1`, 22: "public",
    },
  };
}

const pae = (type, body) => { const t = Buffer.from(type); return Buffer.concat([Buffer.from(`DSSEv1 ${t.length} `), t, Buffer.from(` ${body.length} `), body]); };
const H = (...b) => createHash("sha256").update(Buffer.concat(b)).digest();
function mth(leaves) {
  if (leaves.length === 1) return leaves[0];
  let k = 1; while (k * 2 < leaves.length) k *= 2;
  return H(Buffer.from([1]), mth(leaves.slice(0, k)), mth(leaves.slice(k)));
}
function path(m, leaves) {
  if (leaves.length === 1) return [];
  let k = 1; while (k * 2 < leaves.length) k *= 2;
  return m < k ? [...path(m, leaves.slice(0, k)), mth(leaves.slice(k))] : [...path(m - k, leaves.slice(k)), mth(leaves.slice(0, k))];
}

/**
 * A bundle over `statement` (an in-toto Statement object or raw bytes), signed by a fresh leaf key
 * whose certificate the intermediate issues with `identity`, and logged.
 */
export function makeBundle(ss, identity, statement, { signedAt = at } = {}) {
  const leaf = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const exts = [
    ext("2.5.29.15", tlv(0x03, Buffer.from([7, 0x80])), true),
    ext("2.5.29.37", seq(oid("1.3.6.1.5.5.7.3.3"))),
    ext("2.5.29.35", seq(tlv(0x80, keyId(ss.inter.publicKey)))),
    ext("2.5.29.17", seq(tlv(0x86, Buffer.from(identity.san))), true),
    ...Object.entries(identity.claims).map(([n, v]) => ext(`${FULCIO}${n}`, utf8(v))),
  ];
  const leafDer = certificate({ serial: 1000 + Math.floor(Math.random() * 1e6), issuer: name("fleet-test-intermediate"), subject: seq(), notBefore: signedAt - 60_000, notAfter: signedAt + 540_000, pub: leaf.publicKey, extensions: exts, signer: ss.inter.privateKey });
  const payload = Buffer.isBuffer(statement) ? statement : Buffer.from(JSON.stringify(statement));
  const type = "application/vnd.in-toto+json";
  const sig = sign("sha256", pae(type, payload), leaf.privateKey);
  const certPem = `-----BEGIN CERTIFICATE-----\n${leafDer.toString("base64").match(/.{1,64}/g).join("\n")}\n-----END CERTIFICATE-----\n`;
  const body = Buffer.from(JSON.stringify({ apiVersion: "0.0.1", kind: "dsse", spec: {
    envelopeHash: { algorithm: "sha256", value: createHash("sha256").update("envelope").digest("hex") },
    payloadHash: { algorithm: "sha256", value: createHash("sha256").update(payload).digest("hex") },
    signatures: [{ signature: sig.toString("base64"), verifier: Buffer.from(certPem).toString("base64") }],
  } }));
  const leaves = [H(Buffer.from([0]), Buffer.from("a")), H(Buffer.from([0]), Buffer.from("b")), H(Buffer.from([0]), body), H(Buffer.from([0]), Buffer.from("d")), H(Buffer.from([0]), Buffer.from("e"))];
  const index = 2, size = leaves.length, logIndex = 7000 + index;
  const rootHash = mth(leaves);
  const integratedTime = Math.floor(signedAt / 1000);
  const set = sign("sha256", Buffer.from(`{"body":"${body.toString("base64")}","integratedTime":${integratedTime},"logID":"${ss.logId.toString("hex")}","logIndex":${logIndex}}`), ss.log.privateKey);
  const note = `rekor.fleet-test.invalid - 1\n${size}\n${rootHash.toString("base64")}\n`;
  const noteSig = sign("sha256", Buffer.from(note), ss.log.privateKey);
  const checkpoint = `${note}\n— rekor.fleet-test.invalid ${Buffer.concat([ss.logId.subarray(0, 4), noteSig]).toString("base64")}\n`;
  return {
    mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json",
    verificationMaterial: {
      certificate: { rawBytes: leafDer.toString("base64") },
      tlogEntries: [{
        logIndex: String(logIndex), logId: { keyId: ss.logId.toString("base64") }, kindVersion: { kind: "dsse", version: "0.0.1" },
        integratedTime: String(integratedTime), inclusionPromise: { signedEntryTimestamp: set.toString("base64") },
        inclusionProof: { logIndex: String(index), rootHash: rootHash.toString("base64"), treeSize: String(size), hashes: path(index, leaves).map((h) => h.toString("base64")), checkpoint: { envelope: checkpoint } },
        canonicalizedBody: body.toString("base64"),
      }],
      timestampVerificationData: {},
    },
    dsseEnvelope: { payload: payload.toString("base64"), payloadType: type, signatures: [{ sig: sig.toString("base64") }] },
  };
}

/** An in-toto Statement whose one subject is `bytes`. */
export function statementOver(name, bytes) {
  return { _type: "https://in-toto.io/Statement/v1", subject: [{ name, digest: { sha256: createHash("sha256").update(bytes).digest("hex") } }], predicateType: "https://slsa.dev/provenance/v1", predicate: {} };
}

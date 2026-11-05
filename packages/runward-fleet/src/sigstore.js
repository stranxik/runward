// Offline verification of a Sigstore bundle (what `actions/attest` and `cosign attest-blob` write)
// against a trusted root the operator provides as a file. No network, no clock, no dependency.
//
// What is checked, each as a named step the page shows:
//   the log entry: its key is one the trusted root lists for the signing time, its signed entry
//     timestamp verifies, its Merkle inclusion proof reaches the root a signed checkpoint names, and
//     its body names this envelope's payload, signature and certificate;
//   the certificate: it chains to a certificate authority of the trusted root that was valid at the
//     signing time, the signing time lies inside its validity, and it is a code-signing leaf;
//   the envelope: its DSSE signature verifies under the certificate's key, and its payload is an
//     in-toto Statement.
// The signing time is the log's integrated time, trusted because its signature verified: the
// verifier never reads the machine's clock, so a bundle verifies the same way on any day.
//
// What is not verified in this version, and refused by name rather than passed: RFC 3161
// timestamps (a bundle whose time comes only from a timestamp authority, as on GitHub's instance
// for private repositories, or a Rekor v2 entry), and log entries of a kind other than `dsse`.
import { X509Certificate, createHash, createPublicKey, verify as cryptoVerify } from "node:crypto";
import { readCertificate } from "./der.js";

const BUNDLE_TYPES = new Set([
  "application/vnd.dev.sigstore.bundle+json;version=0.1",
  "application/vnd.dev.sigstore.bundle+json;version=0.2",
  "application/vnd.dev.sigstore.bundle+json;version=0.3",
  "application/vnd.dev.sigstore.bundle.v0.3+json",
]);
const TRUSTED_ROOT_TYPE = /^application\/vnd\.dev\.sigstore\.trustedroot(\.v0\.\d+)?\+json(;version=0\.\d+)?$/;
const STATEMENTS = new Set(["https://in-toto.io/Statement/v1", "https://in-toto.io/Statement/v0.1"]);
const CODE_SIGNING = "1.3.6.1.5.5.7.3.3";

const sha256 = (b) => createHash("sha256").update(b).digest();
const b64 = (s, what) => {
  if (typeof s !== "string" || !/^[A-Za-z0-9+/_-]*={0,2}$/.test(s)) throw new Error(`${what} is not base64`);
  return Buffer.from(s, s.includes("-") || s.includes("_") ? "base64url" : "base64");
};
const pem = (der) => `-----BEGIN CERTIFICATE-----\n${der.toString("base64").match(/.{1,64}/g).join("\n")}\n-----END CERTIFICATE-----\n`;
const ms = (iso) => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new Error(`not a date: ${iso}`);
  return t;
};
const within = (t, validFor) => validFor && t >= ms(validFor.start) && (validFor.end === undefined || t <= ms(validFor.end));

/** DSSE pre-authentication encoding (github.com/secure-systems-lab/dsse, protocol.md). */
export function pae(payloadType, payload) {
  const t = Buffer.from(payloadType, "utf8");
  return Buffer.concat([Buffer.from(`DSSEv1 ${t.length} `), t, Buffer.from(` ${payload.length} `), payload]);
}

/** The digest a key signs with, by its kind; `undefined` for a kind this verifier does not accept. */
function digestFor(key, details) {
  if (details === "PKIX_ED25519" || key.asymmetricKeyType === "ed25519") return null;
  if (key.asymmetricKeyType === "ec") {
    const c = key.asymmetricKeyDetails?.namedCurve;
    if (c === "prime256v1") return "sha256";
    if (c === "secp384r1") return "sha384";
    if (c === "secp521r1") return "sha512";
  }
  return undefined;
}
function verifyWith(key, data, sig, details) {
  const d = digestFor(key, details);
  if (d === undefined) return false;
  try { return cryptoVerify(d, data, key, sig); } catch { return false; }
}

/** RFC 9162 §2.1.3.2: the root an inclusion proof reaches, or null when the proof is malformed. */
export function inclusionRoot(index, size, leafHash, path) {
  let fn = BigInt(index);
  let sn = BigInt(size) - 1n;
  if (fn > sn) return null;
  let r = leafHash;
  for (const p of path) {
    if (sn === 0n) return null;
    if ((fn & 1n) === 1n || fn === sn) {
      r = sha256(Buffer.concat([Buffer.from([1]), p, r]));
      if ((fn & 1n) === 0n) while ((fn & 1n) === 0n && fn !== 0n) { fn >>= 1n; sn >>= 1n; }
    } else {
      r = sha256(Buffer.concat([Buffer.from([1]), r, p]));
    }
    fn >>= 1n;
    sn >>= 1n;
  }
  return sn === 0n ? r : null;
}

/** Read a trusted root file (Sigstore's trusted_root.json format) into keys and certificate chains. */
export function readTrustedRoot(doc) {
  if (!doc || typeof doc !== "object" || !TRUSTED_ROOT_TYPE.test(String(doc.mediaType))) {
    throw new Error(`not a Sigstore trusted root (mediaType ${JSON.stringify(doc?.mediaType)})`);
  }
  const tlogs = (doc.tlogs ?? []).map((t) => {
    const raw = b64(t.publicKey?.rawBytes, "tlog public key");
    const key = createPublicKey({ key: raw, format: "der", type: "spki" });
    const keyId = b64(t.logId?.keyId, "tlog key id");
    return { baseUrl: t.baseUrl, key, keyId, details: t.publicKey?.keyDetails, validFor: t.publicKey?.validFor };
  });
  const cas = (doc.certificateAuthorities ?? []).map((c) => ({
    uri: c.uri,
    subject: c.subject,
    validFor: c.validFor,
    chain: (c.certChain?.certificates ?? []).map((x) => {
      const der = b64(x.rawBytes, "CA certificate");
      return { der, cert: new X509Certificate(der), info: readCertificate(der) };
    }),
  }));
  return { tlogs, cas };
}

/**
 * Verify one bundle against one or more trusted roots (already read). Returns every check by name,
 * the certificate's claims and the signed statement; `ok` is true only when every check holds.
 */
export function verifyBundle(bundle, roots) {
  const checks = [];
  // `as`: "unsupported" for what this version does not verify (never a pass), "skipped" for a check
  // that could not run because an earlier one failed.
  const check = (id, ok, detail, as) => { checks.push({ id, ok: Boolean(ok), detail, ...(as && !ok ? { as } : {}) }); return Boolean(ok); };
  const result = { ok: false, checks, identity: null, statement: null, payload: null, signedAt: null, log: null };
  const done = () => { result.ok = checks.length > 0 && checks.every((c) => c.ok); return result; };

  let leafDer, payload, sig, payloadType;
  try {
    if (!bundle || !BUNDLE_TYPES.has(bundle.mediaType)) throw new Error(`mediaType ${JSON.stringify(bundle?.mediaType)}`);
    const vm = bundle.verificationMaterial ?? {};
    const raw = vm.certificate?.rawBytes ?? vm.x509CertificateChain?.certificates?.[0]?.rawBytes;
    if (!raw) throw new Error("no certificate (a key-only bundle names no CI identity)");
    leafDer = b64(raw, "certificate");
    const env = bundle.dsseEnvelope;
    if (!env) throw new Error("no DSSE envelope (a message signature carries no statement)");
    if (!Array.isArray(env.signatures) || env.signatures.length !== 1) throw new Error("the envelope must carry exactly one signature");
    payloadType = String(env.payloadType);
    payload = b64(env.payload, "payload");
    sig = b64(env.signatures[0].sig, "signature");
    check("bundle-format", true, bundle.mediaType);
  } catch (e) {
    check("bundle-format", false, e.message, /no DSSE envelope|no certificate/.test(e.message) ? "unsupported" : undefined);
    return done();
  }
  result.payload = payload;

  let leaf, leafInfo;
  try {
    leaf = new X509Certificate(leafDer);
    leafInfo = readCertificate(leafDer);
  } catch (e) {
    check("certificate-read", false, e.message);
    return done();
  }
  const san = leafInfo.san.map((s) => s.value);
  result.identity = { san, ...leafInfo.claims };

  // ---- the transparency log: it gives the signing time, so it comes first
  const entries = Array.isArray(bundle.verificationMaterial.tlogEntries) ? bundle.verificationMaterial.tlogEntries : [];
  let signedAt = null;
  if (entries.length === 0) {
    check("tlog-entry", false, "no transparency log entry: this version establishes the signing time from a Rekor v1 signed entry timestamp only", "unsupported");
  }
  for (const entry of entries.slice(0, 1)) {
    let logKey = null, body;
    try {
      const keyId = b64(entry.logId?.keyId, "log id");
      const integrated = BigInt(entry.integratedTime);
      const t = Number(integrated) * 1000;
      const candidates = roots.flatMap((r) => r.tlogs).filter((l) => l.keyId.equals(keyId));
      logKey = candidates.find((l) => within(t, l.validFor)) ?? null;
      check("tlog-key", logKey, logKey ? `${logKey.baseUrl}, key valid at the signing time` : candidates.length ? "the log key was not valid at the integrated time" : "the log key is not in the trusted root");
      body = b64(entry.canonicalizedBody, "log entry body");
      if (!entry.inclusionPromise?.signedEntryTimestamp) {
        check("tlog-set", false, "no signed entry timestamp: a Rekor v2 entry takes its time from an RFC 3161 timestamp, which this version does not verify", "unsupported");
      } else if (logKey) {
        const setPayload = `{"body":"${body.toString("base64")}","integratedTime":${integrated},"logID":"${keyId.toString("hex")}","logIndex":${BigInt(entry.logIndex)}}`;
        const ok = verifyWith(logKey.key, Buffer.from(setPayload, "utf8"), b64(entry.inclusionPromise.signedEntryTimestamp, "signed entry timestamp"), logKey.details);
        if (check("tlog-set", ok, ok ? `integrated time ${new Date(t).toISOString()} (the log's, not this machine's)` : "the signed entry timestamp does not verify")) signedAt = t;
      }
      const proof = entry.inclusionProof;
      if (!proof) check("tlog-inclusion", false, "no inclusion proof");
      else if (logKey) {
        const leafHash = sha256(Buffer.concat([Buffer.from([0]), body]));
        const root = inclusionRoot(proof.logIndex, proof.treeSize, leafHash, (proof.hashes ?? []).map((h) => b64(h, "proof hash")));
        const want = b64(proof.rootHash, "root hash");
        check("tlog-inclusion", root && root.equals(want), root && root.equals(want) ? `leaf ${proof.logIndex} of ${proof.treeSize}` : "the inclusion proof does not reach its root hash");
        const envText = String(proof.checkpoint?.envelope ?? "");
        const cut = envText.indexOf("\n\n");
        const note = cut >= 0 ? envText.slice(0, cut + 1) : "";
        const lines = note.split("\n");
        const sigs = cut >= 0 ? envText.slice(cut + 2).split("\n").filter(Boolean) : [];
        const hint = logKey.keyId.subarray(0, 4);
        const signed = sigs.some((l) => {
          const m = /^— (\S+) (\S+)$/.exec(l);
          if (!m) return false;
          const bytes = b64(m[2], "checkpoint signature");
          return bytes.length > 4 && bytes.subarray(0, 4).equals(hint) && verifyWith(logKey.key, Buffer.from(note, "utf8"), bytes.subarray(4), logKey.details);
        });
        const names = lines[1] === String(proof.treeSize) && lines[2] === want.toString("base64");
        check("tlog-checkpoint", signed && names, signed && names ? "signed by the log key, names the proof's root and size" : !signed ? "the checkpoint is not signed by the log key" : "the checkpoint names another root or size");
      }
      // The log entry must be about THIS envelope and THIS certificate.
      const b = JSON.parse(body.toString("utf8"));
      const kind = entry.kindVersion ?? {};
      if (b.kind !== "dsse" || b.apiVersion !== "0.0.1" || kind.kind !== b.kind || kind.version !== b.apiVersion) {
        check("tlog-body", false, `log entry kind ${b.kind}/${b.apiVersion}: this version reads dsse/0.0.1 only`, "unsupported");
      } else {
        const ph = b.spec?.payloadHash;
        const s = b.spec?.signatures ?? [];
        const verifierPem = s.length === 1 ? Buffer.from(String(s[0].verifier ?? ""), "base64").toString("utf8") : "";
        const samePayload = ph?.algorithm === "sha256" && ph.value === sha256(payload).toString("hex");
        const sameSig = s.length === 1 && b64(s[0].signature, "logged signature").equals(sig);
        const sameCert = verifierPem.replace(/\r/g, "") === pem(leafDer);
        check("tlog-body", samePayload && sameSig && sameCert,
          samePayload && sameSig && sameCert ? "the entry names this payload, this signature and this certificate"
            : !samePayload ? "the entry names another payload" : !sameSig ? "the entry names another signature" : "the entry names another certificate");
      }
      result.log = { url: logKey?.baseUrl ?? null, logIndex: String(entry.logIndex), integratedTime: String(entry.integratedTime) };
    } catch (e) {
      check("tlog-entry", false, e.message);
    }
  }
  result.signedAt = signedAt;

  // ---- the certificate, at the log's time
  if (signedAt === null) {
    check("certificate-chain", false, "not evaluated: no verified signing time", "skipped");
  } else {
    let chained = null;
    for (const ca of roots.flatMap((r) => r.cas)) {
      if (!within(signedAt, ca.validFor) || ca.chain.length === 0) continue;
      let ok = leaf.checkIssued(ca.chain[0].cert) && leaf.verify(ca.chain[0].cert.publicKey);
      for (let k = 0; ok && k < ca.chain.length; k++) {
        const c = ca.chain[k];
        const parent = ca.chain[k + 1] ?? c; // the last one is self-signed
        ok = c.info.ca && c.cert.checkIssued(parent.cert) && c.cert.verify(parent.cert.publicKey)
          && signedAt >= c.info.notBefore && signedAt <= c.info.notAfter;
      }
      if (ok) { chained = ca; break; }
    }
    check("certificate-chain", chained, chained ? `chains to ${chained.uri ?? "a certificate authority"} of the trusted root` : "no certificate authority of the trusted root issued this certificate at the signing time");
    check("certificate-validity", signedAt >= leafInfo.notBefore && signedAt <= leafInfo.notAfter,
      `valid ${new Date(leafInfo.notBefore).toISOString()} to ${new Date(leafInfo.notAfter).toISOString()}`);
  }
  check("certificate-usage", leafInfo.eku.includes(CODE_SIGNING) && !leafInfo.ca, leafInfo.eku.includes(CODE_SIGNING) && !leafInfo.ca ? "code-signing leaf" : "not a code-signing leaf certificate");

  // ---- the envelope
  const okSig = verifyWith(leaf.publicKey, pae(payloadType, payload), sig);
  check("dsse-signature", okSig, okSig ? "verifies under the certificate's key" : "the signature does not verify for this payload");
  try {
    const st = JSON.parse(payload.toString("utf8"));
    const okSt = payloadType === "application/vnd.in-toto+json" && STATEMENTS.has(st?._type) && Array.isArray(st.subject);
    if (check("statement", okSt, okSt ? `${st._type}, ${st.subject.length} subject(s)` : "the payload is not an in-toto Statement")) result.statement = st;
  } catch {
    check("statement", false, "the payload is not JSON");
  }
  return done();
}

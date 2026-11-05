// A small DER reader: enough of X.509 to read what a Sigstore leaf certificate claims, nothing more.
//
// node:crypto's X509Certificate checks signatures and issuers, but it does not expose the Fulcio
// extensions (the workflow, the ref, the commit a CI identity signed under), nor the validity as
// numbers. Reading them here keeps runward-fleet free of any dependency. Every read is bounded by
// the buffer it was given: a length that runs past its parent is refused, never truncated.

/** Parse one TLV at `offset` of `buf`, inside `[offset, limit)`. */
export function readTLV(buf, offset = 0, limit = buf.length) {
  if (offset + 2 > limit) throw new Error("DER: truncated header");
  const first = buf[offset];
  let pos = offset + 1;
  let num = first & 0x1f;
  if (num === 0x1f) {
    num = 0;
    let b;
    do {
      if (pos >= limit) throw new Error("DER: truncated tag");
      b = buf[pos++];
      num = num * 128 + (b & 0x7f);
    } while (b & 0x80);
  }
  if (pos >= limit) throw new Error("DER: truncated length");
  let len = buf[pos++];
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0) throw new Error("DER: indefinite length is not DER");
    if (n > 4) throw new Error("DER: length too large");
    len = 0;
    for (let i = 0; i < n; i++) {
      if (pos >= limit) throw new Error("DER: truncated length");
      len = len * 256 + buf[pos++];
    }
  }
  const end = pos + len;
  if (end > limit) throw new Error("DER: value runs past its parent");
  return {
    cls: first >> 6,
    constructed: (first & 0x20) !== 0,
    num,
    tag: first,
    start: offset,
    valueStart: pos,
    end,
    value: buf.subarray(pos, end),
    raw: buf.subarray(offset, end),
  };
}

/** The children of a constructed TLV, read against the buffer it was parsed from. */
export function children(tlv) {
  if (!tlv.constructed) throw new Error("DER: not a constructed value");
  const out = [];
  let pos = tlv.valueStart;
  while (pos < tlv.end) {
    const c = parseAt(tlv._buf, pos, tlv.end);
    out.push(c);
    pos = c.end;
  }
  return out;
}

/** readTLV, remembering the buffer so children() can walk it. */
export function parseAt(buf, offset = 0, limit = buf.length) {
  const t = readTLV(buf, offset, limit);
  t._buf = buf;
  return t;
}

/** Decode an OBJECT IDENTIFIER value to its dotted form. */
export function oid(value) {
  if (value.length === 0) throw new Error("DER: empty OID");
  const parts = [];
  const first = value[0];
  parts.push(first < 80 ? Math.floor(first / 40) : 2, first < 80 ? first % 40 : first - 80);
  let n = 0;
  for (let i = 1; i < value.length; i++) {
    n = n * 128 + (value[i] & 0x7f);
    if (!(value[i] & 0x80)) { parts.push(n); n = 0; }
  }
  return parts.join(".");
}

/** UTCTime or GeneralizedTime, as milliseconds since the epoch (a parse, never a clock). */
export function time(tlv) {
  const s = tlv.value.toString("latin1");
  let m;
  if (tlv.num === 23 && (m = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/.exec(s))) {
    const yy = Number(m[1]);
    return Date.UTC(yy >= 50 ? 1900 + yy : 2000 + yy, Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
  }
  if (tlv.num === 24 && (m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\.\d+)?Z$/.exec(s))) {
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]));
  }
  throw new Error(`DER: unsupported time ${JSON.stringify(s)}`);
}

// The Fulcio certificate extensions (github.com/sigstore/fulcio, docs/oid-info.md). Versions 1 hold
// the raw bytes; versions 2 (from .8) hold a DER UTF8String. Only the claims runward-fleet reads are
// named; every other extension is ignored, never guessed.
const FULCIO = "1.3.6.1.4.1.57264.1.";
const CLAIMS = {
  8: "issuer",
  9: "buildSignerURI",
  10: "buildSignerDigest",
  11: "runnerEnvironment",
  12: "sourceRepositoryURI",
  13: "sourceRepositoryDigest",
  14: "sourceRepositoryRef",
  15: "sourceRepositoryIdentifier",
  16: "sourceRepositoryOwnerURI",
  18: "buildConfigURI",
  19: "buildConfigDigest",
  20: "buildTrigger",
  21: "runInvocationURI",
  22: "sourceRepositoryVisibilityAtSigning",
};
const LEGACY = { 1: "issuer" };

/**
 * Read a DER certificate: its validity, its subject alternative names, its extended key usages,
 * whether it is a CA, and the Fulcio claims it carries.
 */
export function readCertificate(der) {
  const cert = parseAt(der);
  const [tbs] = children(cert);
  const fields = children(tbs);
  let i = 0;
  if (fields[0].cls === 2 && fields[0].num === 0) i = 1; // [0] EXPLICIT version
  const validity = children(fields[i + 3]);
  const out = {
    notBefore: time(validity[0]),
    notAfter: time(validity[1]),
    san: [],
    eku: [],
    ca: false,
    claims: {},
  };
  const ext = fields.find((f) => f.cls === 2 && f.num === 3);
  if (!ext) return out;
  const [list] = children(ext);
  for (const e of children(list)) {
    const parts = children(e);
    const id = oid(parts[0].value);
    const value = parts[parts.length - 1].value;
    if (id === "2.5.29.17") {
      for (const gn of children(parseAt(value))) {
        if (gn.cls === 2 && gn.num === 6) out.san.push({ type: "uri", value: gn.value.toString("utf8") });
        else if (gn.cls === 2 && gn.num === 1) out.san.push({ type: "email", value: gn.value.toString("utf8") });
      }
    } else if (id === "2.5.29.37") {
      for (const k of children(parseAt(value))) out.eku.push(oid(k.value));
    } else if (id === "2.5.29.19") {
      const bc = children(parseAt(value));
      out.ca = bc.length > 0 && bc[0].num === 1 && bc[0].value[0] !== 0;
    } else if (id.startsWith(FULCIO)) {
      const n = Number(id.slice(FULCIO.length));
      if (CLAIMS[n]) {
        const inner = parseAt(value);
        if (inner.num !== 12) throw new Error(`certificate extension ${id} is not a UTF8String`);
        out.claims[CLAIMS[n]] = inner.value.toString("utf8");
      } else if (LEGACY[n] && out.claims[LEGACY[n]] === undefined) {
        out.claims[`legacy:${LEGACY[n]}`] = value.toString("utf8");
      }
    }
  }
  if (out.claims.issuer === undefined && out.claims["legacy:issuer"] !== undefined) out.claims.issuer = out.claims["legacy:issuer"];
  delete out.claims["legacy:issuer"];
  return out;
}

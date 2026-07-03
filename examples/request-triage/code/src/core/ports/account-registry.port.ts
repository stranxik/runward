// Secondary port: the account registry, a deterministic source of truth.
// The guard resolves every model-proposed account reference against it: a
// reference that does not resolve is never routed on (ADR-0002). The model
// cannot mint an account into existence.

export interface Account {
  ref: string;
  name: string;
}

export interface AccountRegistryPort {
  // Returns the account when the reference exists, null otherwise. Pure
  // lookup: no fuzzy matching, no repair of a fabricated reference.
  resolve(ref: string): Account | null;
}

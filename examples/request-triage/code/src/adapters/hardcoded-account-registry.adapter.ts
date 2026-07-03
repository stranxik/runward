// Account registry adapter: a small hard-coded table standing in for the
// organization's system of record. The point is the contract, not the store:
// the guard resolves references here, and a reference the registry does not
// know is never routed on — however plausible the model made it look.

import type {
  AccountRegistryPort,
  Account,
} from "../core/ports/account-registry.port.js";

const ACCOUNTS: readonly Account[] = [
  { ref: "ACC-1001", name: "Acme Corp" },
  { ref: "ACC-2002", name: "Globex Industries" },
  { ref: "ACC-3003", name: "Initech Ltd" },
];

export class HardcodedAccountRegistry implements AccountRegistryPort {
  private readonly byRef = new Map(ACCOUNTS.map((a) => [a.ref, a]));

  resolve(ref: string): Account | null {
    return this.byRef.get(ref) ?? null;
  }
}

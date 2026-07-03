// Deterministic guard on model-extracted fields (ADR-0002). Pure functions,
// unit-testable without a model in the loop.
//
// The rule: THE MODEL NEVER SUPPLIES A VALUE THE SYSTEM CAN COMPUTE OR
// VERIFY ITSELF. Concretely:
//   - an account reference is resolved against the account registry; a
//     reference that does not resolve is never routed on — the record
//     escalates to human review with the reason attached;
//   - a deadline is re-parsed from the source text by a deterministic
//     parser; the model's proposal is DISCARDED in favor of the parsed
//     value, whatever the model said;
//   - the category must belong to the closed vocabulary; anything else is
//     treated as "unknown" (abstention), never as a new category.

import {
  CategorySchema,
  type Category,
  type TriageField,
} from "./triage.js";
import type { AccountRegistryPort } from "../ports/account-registry.port.js";
import type { TriageProposal } from "../ports/model-provider.port.js";

// ----------------------------------------------------------------------------
// Deterministic deadline parser. Reads ISO dates (YYYY-MM-DD) from the raw
// source text and validates them as real calendar dates. Returns the first
// valid one, normalized, or null. No model involved.
// ----------------------------------------------------------------------------
const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b/g;

export function parseDeadline(sourceText: string): string | null {
  for (const m of sourceText.matchAll(ISO_DATE)) {
    const [raw, y, mo, d] = m;
    const year = Number(y);
    const month = Number(mo);
    const day = Number(d);
    // Real calendar date, not just a well-shaped string.
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return raw;
    }
  }
  return null;
}

// ----------------------------------------------------------------------------
// Category guard: closed vocabulary or abstention.
// ----------------------------------------------------------------------------
export function guardCategory(proposed: unknown): Category {
  const parsed = CategorySchema.safeParse(proposed);
  return parsed.success ? parsed.data : "unknown";
}

// ----------------------------------------------------------------------------
// Field guard: promote, recompute, or escalate.
// ----------------------------------------------------------------------------
export interface GuardedFields {
  accountRef?: TriageField & { accountName?: string };
  deadline?: TriageField;
  // Non-empty when a proposed value failed verification: the record must
  // escalate to human review instead of routing (fail-closed).
  escalations: string[];
}

export function guardFields(
  proposal: TriageProposal,
  sourceText: string,
  registry: AccountRegistryPort,
): GuardedFields {
  const out: GuardedFields = { escalations: [] };

  // Account reference: verified against the registry or never routed on.
  const proposedRef = proposal.fields.find((f) => f.name === "accountRef");
  if (proposedRef) {
    const account = registry.resolve(proposedRef.value);
    if (account) {
      out.accountRef = {
        value: account.ref,
        provenance: "verified",
        accountName: account.name,
      };
    } else {
      out.escalations.push(
        `unverified account reference "${proposedRef.value}" (not in registry)`,
      );
    }
  }

  // Deadline: recomputed from the source text; the model's value is
  // discarded even when present, even when it looks right.
  const parsed = parseDeadline(sourceText);
  if (parsed) {
    out.deadline = { value: parsed, provenance: "computed" };
  }

  return out;
}

// ----------------------------------------------------------------------------
// Deterministic approval summary for a suspended compliance record: a pure
// function of the validated fields, never a model reformulation.
// ----------------------------------------------------------------------------
export function buildApprovalSummary(
  requestId: string,
  category: Category,
  targetQueue: string,
  accountRef?: TriageField,
  deadline?: TriageField,
): string {
  const parts = [
    `Approval required: route request "${requestId}"`,
    `category=${category}`,
    `queue=${targetQueue}`,
    `accountRef=${accountRef ? `${accountRef.value} (${accountRef.provenance})` : "none"}`,
    `deadline=${deadline ? `${deadline.value} (${deadline.provenance})` : "none"}`,
  ];
  return parts.join(" | ");
}

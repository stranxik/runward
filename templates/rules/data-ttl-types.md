---
title: TTL by Data Type
phases: [govern]
impact: MEDIUM
impactDescription: Ensures proper data lifecycle management and compliance
tags: [data, lifecycle, compliance, ttl]
noTerritory: It sets a retention and erasure policy per data type — a compliance decision governing the lifecycle of the data itself, not a class of files.
---

## TTL by Data Type

Different data types require different retention policies. Define TTLs at the schema level.

**Example TTLs:**

> The durations below are **examples — set actual retention periods with legal counsel; they are jurisdiction-specific** (statutory retention duties, storage-limitation principles, sector rules).

| Data Type | TTL | Action at Expiration |
|-----------|-----|---------------------|
| Active chat sessions | Session duration | Archive + summarize |
| Archived sessions | 2 years | Pseudonymize then delete |
| Active projects | Project duration | Archive |
| Completed projects | 5 years | Pseudonymize personal data |
| Agent memories | Progressive decay | Prune if score < threshold |
| Audit logs | 5 years (legal) | Cold archive |
| Technical logs | 90 days | Delete |
| API tokens | 90 days | Revoke |
| Password reset | 1 hour | Delete |

**Implementation:**

```typescript
// Schema with TTL metadata
interface DataSchema {
  type: string;
  ttlDays: number | null;  // null = never expires
  expirationAction: 'delete' | 'archive' | 'pseudonymize';
}

const dataSchemas: Record<string, DataSchema> = {
  chatSession: { type: 'chatSession', ttlDays: null, expirationAction: 'archive' },
  archivedSession: { type: 'archivedSession', ttlDays: 730, expirationAction: 'pseudonymize' },
  auditLog: { type: 'auditLog', ttlDays: 1825, expirationAction: 'archive' },
  technicalLog: { type: 'technicalLog', ttlDays: 90, expirationAction: 'delete' },
  memory: { type: 'memory', ttlDays: null, expirationAction: 'delete' },  // Score-based
};

// Cleanup cron job
async function runDataCleanup() {
  for (const [type, schema] of Object.entries(dataSchemas)) {
    if (!schema.ttlDays) continue;

    const cutoff = new Date(Date.now() - schema.ttlDays * 24 * 60 * 60 * 1000);

    switch (schema.expirationAction) {
      case 'delete':
        await db.deleteWhere(type, { createdAt: { lt: cutoff } });
        break;
      case 'archive':
        await db.archiveWhere(type, { createdAt: { lt: cutoff } });
        break;
      case 'pseudonymize':
        await db.pseudonymizeWhere(type, { createdAt: { lt: cutoff } });
        break;
    }

    logger.info(`Data cleanup completed for ${type}`, { cutoff, action: schema.expirationAction });
  }
}

// Run daily
cron.schedule('0 3 * * *', runDataCleanup);
```

**Pseudonymization Pattern (this is NOT anonymization):**

A hashed email is still personal data: the hash is a stable pseudonym that can be linked back to the person (dictionary attack on known addresses, or simply joining on the same hash elsewhere). Data-protection regimes such as the GDPR treat pseudonymized data as personal data, with all obligations attached. True **anonymization** is irreversible — outright deletion of identifying fields, or aggregation into counts that no longer describe an individual.

```typescript
// Pseudonymization: reversible in principle, still personal data.
async function pseudonymizeRecord(record: UserData): Promise<PseudonymizedData> {
  return {
    ...record,
    email: hashEmail(record.email),  // stable pseudonym, NOT anonymous
    name: null,
    phone: null,
    address: null,
    // Keep non-personal fields for analytics
    createdAt: record.createdAt,
    projectCount: record.projectCount,
  };
}

// Anonymization: irreversible. Either delete the record outright, or
// keep only aggregates that no longer describe an individual.
async function anonymizeIntoAggregates(records: UserData[]): Promise<void> {
  await db.analytics.increment('projects_completed', sum(records.map(r => r.projectCount)));
  await db.deleteMany(records.map(r => r.id));  // individual rows are gone
}
```

Decide per field, with legal counsel, whether pseudonymization is enough (data stays in scope of the regulation) or true anonymization is required.

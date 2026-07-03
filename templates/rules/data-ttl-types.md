---
title: TTL by Data Type
impact: MEDIUM
impactDescription: Ensures proper data lifecycle management and compliance
tags: [data, lifecycle, compliance, ttl]
---

## TTL by Data Type

Different data types require different retention policies. Define TTLs at the schema level.

**Recommended TTLs:**

| Data Type | TTL | Action at Expiration |
|-----------|-----|---------------------|
| Active chat sessions | Session duration | Archive + summarize |
| Archived sessions | 2 years | Anonymize then delete |
| Active projects | Project duration | Archive |
| Completed projects | 5 years | Anonymize personal data |
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
  expirationAction: 'delete' | 'archive' | 'anonymize';
}

const dataSchemas: Record<string, DataSchema> = {
  chatSession: { type: 'chatSession', ttlDays: null, expirationAction: 'archive' },
  archivedSession: { type: 'archivedSession', ttlDays: 730, expirationAction: 'anonymize' },
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
      case 'anonymize':
        await db.anonymizeWhere(type, { createdAt: { lt: cutoff } });
        break;
    }

    logger.info(`Data cleanup completed for ${type}`, { cutoff, action: schema.expirationAction });
  }
}

// Run daily
cron.schedule('0 3 * * *', runDataCleanup);
```

**Anonymization Pattern:**

```typescript
async function anonymizeRecord(record: UserData): Promise<AnonymizedData> {
  return {
    ...record,
    email: hashEmail(record.email),
    name: 'Anonymous User',
    phone: null,
    address: null,
    // Keep non-PII for analytics
    createdAt: record.createdAt,
    projectCount: record.projectCount,
  };
}
```

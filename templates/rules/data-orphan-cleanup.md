---
title: Orphan Data Cleanup
impact: MEDIUM
impactDescription: Prevents data bloat from orphaned records
tags: [data, cleanup, maintenance, integrity]
noTerritory: It is selected by subject — which records can lose their parent — and not by cadence: the crons its table names are a schedule, not a place, so a cron territory would match every scheduled job and none of the orphan condition.
---

## Orphan Data Cleanup

Orphaned records waste storage and can cause bugs. Regular cleanup is essential.

**Common Orphan Types:**

| Orphan Type | Detection | Action |
|-------------|-----------|--------|
| Project without owner | Cron weekly | Notify admin, archive after 30d |
| Messages without session | Cron daily | Anonymize + archive |
| Files (S3) without DB ref | Cron monthly | Quarantine then delete |
| Broken DB relationships | Cron weekly | Rebuild or delete |
| Unused embeddings | Cron monthly | Delete |

**Implementation:**

```typescript
// Orphan detection and cleanup service
class OrphanCleanupService {
  async findOrphanProjects(): Promise<Project[]> {
    return db.projects.findMany({
      where: {
        OR: [
          { ownerId: null },
          { owner: { deletedAt: { not: null } } },
        ],
        orphanedAt: null,  // Not already marked
      },
    });
  }

  async handleOrphanProjects() {
    const orphans = await this.findOrphanProjects();

    for (const project of orphans) {
      // Mark as orphaned, set deadline
      await db.projects.update({
        where: { id: project.id },
        data: {
          orphanedAt: new Date(),
          archiveDeadline: addDays(new Date(), 30),
        },
      });

      // Notify admins
      await notifyAdmins('orphan_project', {
        projectId: project.id,
        projectName: project.name,
        archiveDeadline: addDays(new Date(), 30),
      });
    }

    logger.info('Orphan projects processed', { count: orphans.length });
  }

  async archiveExpiredOrphans() {
    const expired = await db.projects.findMany({
      where: {
        archiveDeadline: { lt: new Date() },
        archivedAt: null,
      },
    });

    for (const project of expired) {
      await this.archiveProject(project);
    }
  }

  async findOrphanFiles(): Promise<string[]> {
    // List all S3 files
    const s3Files = await s3.listObjects({ Bucket: 'uploads' });

    // Get all referenced files from DB
    const referencedFiles = await db.files.findMany({
      select: { s3Key: true },
    });
    const referencedSet = new Set(referencedFiles.map(f => f.s3Key));

    // Find orphans
    return s3Files
      .filter(f => !referencedSet.has(f.Key))
      .map(f => f.Key);
  }

  async cleanupOrphanFiles() {
    const orphans = await this.findOrphanFiles();

    // Move to quarantine first (safety)
    for (const key of orphans) {
      await s3.copyObject({
        CopySource: `uploads/${key}`,
        Bucket: 'uploads-quarantine',
        Key: key,
      });
    }

    logger.info('Orphan files quarantined', { count: orphans.length });

    // Delete from main bucket after 30 days in quarantine
    // (separate cron job)
  }
}

// Schedule cleanup jobs
cron.schedule('0 2 * * 0', () => orphanService.handleOrphanProjects());  // Weekly
cron.schedule('0 3 * * *', () => orphanService.archiveExpiredOrphans());  // Daily
cron.schedule('0 4 1 * *', () => orphanService.cleanupOrphanFiles());     // Monthly
```

**Database Integrity Check:**

```typescript
async function checkDatabaseIntegrity() {
  const issues: IntegrityIssue[] = [];

  // Check foreign key references
  const brokenRefs = await db.$queryRaw`
    SELECT m.id, m.session_id
    FROM messages m
    LEFT JOIN sessions s ON m.session_id = s.id
    WHERE s.id IS NULL
  `;

  if (brokenRefs.length > 0) {
    issues.push({
      type: 'broken_reference',
      table: 'messages',
      count: brokenRefs.length,
      ids: brokenRefs.map(r => r.id),
    });
  }

  return issues;
}
```

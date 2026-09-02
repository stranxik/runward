---
title: Alert Configuration
phases: [govern]
impact: MEDIUM
impactDescription: Ensures timely notification of production issues
tags: [observability, alerting, production]
noTerritory: It fixes which alerts exist and how fast each tier is answered — a policy of the operated system that the rule itself shows realised as a YAML file, as rules in code, or in an alerting vendor outside the repository, so no path delimits it.
---

## Alert Configuration

Configure alerts to catch issues before they impact users.

**Alert Tiers:**

| Tier | Response Time | Examples |
|------|---------------|----------|
| P0 - Critical | <15 min | Service down, data loss |
| P1 - High | <1 hour | Error rate spike, degraded performance |
| P2 - Medium | <4 hours | Elevated latency, cache degradation |
| P3 - Low | Next business day | Cost anomaly, capacity warning |

**Recommended Alerts:**

```yaml
# alerts.yaml
alerts:
  # P0 - Critical
  - name: service_down
    condition: healthcheck_failures > 3
    window: 5m
    severity: critical
    notify: [pagerduty, slack-critical]

  - name: error_rate_critical
    condition: error_rate > 10%
    window: 5m
    severity: critical
    notify: [pagerduty, slack-critical]

  # P1 - High
  - name: error_rate_elevated
    condition: error_rate > 5%
    window: 5m
    severity: high
    notify: [slack-alerts]

  - name: llm_provider_failing
    condition: llm_error_rate > 5%
    window: 5m
    severity: high
    notify: [slack-alerts]

  - name: latency_degraded
    condition: p95_latency > 5000ms
    window: 10m
    severity: high
    notify: [slack-alerts]

  # P2 - Medium
  - name: cache_hit_low
    condition: cache_hit_rate < 50%
    window: 30m
    severity: medium
    notify: [slack-engineering]

  - name: db_connections_high
    condition: db_pool_usage > 80%
    window: 15m
    severity: medium
    notify: [slack-engineering]

  # P3 - Low
  - name: daily_cost_anomaly
    condition: daily_cost > 2x avg_daily_cost
    window: 24h
    severity: low
    notify: [email-team]

  - name: disk_space_warning
    condition: disk_usage > 70%
    window: 1h
    severity: low
    notify: [slack-engineering]
```

**Implementation with the telemetry sink:**

```typescript
// Alert configuration in code
const alertRules = [
  {
    name: 'High Error Rate',
    query: `
      SELECT count(*) as errors
      FROM logs
      WHERE level = 'error'
      AND timestamp > now() - 5m
    `,
    threshold: { errors: 100 },
    severity: 'high',
    channels: ['slack-alerts'],
  },
  {
    name: 'LLM Cost Spike',
    query: `
      SELECT sum(estimatedCost) as cost
      FROM llm_metrics
      WHERE timestamp > now() - 1h
    `,
    threshold: { cost: 50 },
    severity: 'medium',
    channels: ['slack-engineering'],
  },
];

// Alert evaluation
async function evaluateAlerts() {
  for (const rule of alertRules) {
    const result = await telemetry.query(rule.query);

    if (exceedsThreshold(result, rule.threshold)) {
      await sendAlert({
        name: rule.name,
        severity: rule.severity,
        channels: rule.channels,
        data: result,
      });
    }
  }
}

// Run every minute
cron.schedule('* * * * *', evaluateAlerts);
```

**Alert Message Format:**

```typescript
interface AlertMessage {
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  summary: string;
  metrics: Record<string, number>;
  runbook?: string;
  dashboardUrl?: string;
}

// Example Slack message
const message = {
  title: 'High Error Rate Detected',
  severity: 'high',
  summary: 'Error rate exceeded 5% threshold for 5 minutes',
  metrics: {
    errorRate: 7.2,
    errorCount: 156,
    affectedEndpoints: 3,
  },
  runbook: 'https://wiki/runbooks/high-error-rate',
  dashboardUrl: 'https://grafana/d/errors',
};
```

# Principles: Operational Excellence

These principles guide infrastructure and deployment decisions:

## 1. Reliability is the core metric
- Uptime ≥99.9% is the target (three nines ≈ 8.8 hours/year of downtime; four nines, 99.99%, ≈ 53 minutes/year)
- If you're choosing between a feature and reliability, pick reliability
- Outages compound: every minute down costs users + reputation
- Failure is inevitable; design for graceful degradation, not perfection

## 2. Observability precedes operations
- You can't fix what you can't see
- Logging: what happened, when, and why (not just error codes)
- Metrics: latency, error rate, resource usage: measure the things users care about
- Tracing: follow a request through the system
- Alerts on real problems; silence noise

## 3. Deploy small and often
- Big deploys = big blast radius; small deploys = surgical precision
- Daily deployments are safer than monthly (if you have tests)
- Canary deploy: a small slice first (10% by default, per `workflow.md` mode 3), then 100%; catch bugs before they hit everyone
- Rollback must be instant (if a deploy breaks, revert immediately)

## 4. Unused resources are waste
- Audit unused resources regularly and remove them

## 5. Security is infrastructure, not optional
- Network isolation: not everything talks to everything
- Secrets: never in code, config, or logs: use a secrets manager
- Access control: least privilege (minimum permissions needed)
- Compliance: if you're regulated, know your obligations before you deploy

## 6. Incidents are learning opportunities
- Post-incident review (blameless): what happened, why, what prevents it next time
- Every incident surfaces a gap; fix the gap, not just the symptom
- If the same incident happens twice, your incident response is broken
- Incident drills: practice failover before you need it in an emergency

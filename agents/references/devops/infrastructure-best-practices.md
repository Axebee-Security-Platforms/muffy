## Infrastructure best practices

Apply these to the infrastructure you propose and build in mode 1 and mode 2, and check the deployed result in mode 3. They are durable practices, not product-specific syntax: for a version-specific setting follow the repo, the lockfile and the provider's own docs, never memory. Scale them to the task: an MVP needs the **Baseline**; add **Production** before the production deploy; **Regulated** only when `requirements.md` or an ADR says so. A practice that does not apply is left out, not padded.

In `deploy.md` `## Practices` list each one that applies as `met`, `planned (<where>)` or `gap (<risk>)`. A gap is also a line under `## Risks`. Never write `met` for something you did not see in a file or a run.

### Baseline (every deploy)
- **Everything as code:** infrastructure, config and deploy steps live in the repo (IaC, compose, scripts), reviewed like code. No hand-made changes that nobody can reproduce
- **Reproducible builds:** pin runtime, base image and dependencies (lockfile, image digest or tag); the same commit builds the same artifact. Build once, promote the same artifact through environments
- **Config and secrets:** configuration from the environment, not baked into the image; secrets in a secrets manager or the platform's store, never in code, images, logs or `.env` files in git; rotate and scope them
- **Least privilege:** every service, human and pipeline gets the minimum access; no shared root credentials; separate accounts or projects for staging and production
- **Network:** expose only what must be public; databases and internal services are not reachable from the internet; TLS everywhere traffic leaves a host; a firewall or security group default-denies
- **Health and rollback:** every service has a health check that proves it can do its job; a deploy can roll back to the previous artifact quickly, and a failed health check stops the rollout
- **Logs and basic monitoring:** structured logs shipped off the host, plus the golden signals (latency, errors, traffic, saturation) and an alert on the ones users feel
- **Backups with a tested restore:** data you cannot lose is backed up on a schedule, kept off the failure domain, and a restore has been tried at least once; state the RPO and RTO you are aiming for
- **Environments:** staging mirrors production in shape (same runtime, same dependency types, same deploy path) even if smaller
- **Resource hygiene:** resources sized to measured need, and temporary environments that expire (see [infrastructure-options.md](infrastructure-options.md))

### Production (before the production deploy)
- **Availability:** no single point of failure for what the uptime target requires (redundant instances across failure domains, replicated or managed datastore, load balancing); autoscaling has a floor and a ceiling; capacity has headroom for the expected peak
- **Release safety:** canary or staged rollout, an automated rollback trigger on error rate, and database migrations that are reversible or backward compatible
- **Observability:** tracing for request paths that cross services, dashboards for the service-level objectives, alerts that page a human only for real problems and carry a runbook link, and retention set deliberately
- **Disaster recovery:** a written recovery procedure, backups restorable into a clean environment, and a restore drill on a schedule; the RPO and RTO are met by design, not hoped for
- **Patching and updates:** a routine for OS, runtime and base-image updates and for vulnerability scanning of images and dependencies; an owner for each
- **Supply chain:** images and packages from trusted registries, scanned, with a record of what is in them (SBOM) where the team uses one; CI credentials short-lived and scoped
- **Access and audit:** admin actions are logged, access reviewed on a schedule, and break-glass access is controlled and alerted
- **Runbooks and ownership:** every alert, restore and failover has a runbook and a named owner; an incident review (blameless) follows each real incident

### Regulated (only when stated)
- Data location and residency, encryption at rest with managed keys, retention and deletion, audit evidence, segregation of duties, vendor and sub-processor review. Say which obligations were assumed; do not claim compliance, only that the controls named are in place

### On-premises and colocation (in addition)
- **Hardware redundancy:** redundant power supplies and disks (RAID or equivalent), more than one node for anything the uptime target covers, spares on hand or on contract
- **Power and environment:** UPS and generator or a second feed, cooling and monitoring of temperature and power, rack and cable hygiene
- **Network:** redundant uplinks and switches, a segmented network (management, storage, application), an out-of-band management path
- **Capacity and lifecycle:** headroom for growth given the procurement lead time, a hardware refresh plan before end of support, firmware and BIOS patching routine
- **Platform:** pick one virtualization or orchestration layer and operate it as code (IaC and configuration management); no hand-built snowflake servers
- **Backups:** follow 3-2-1 (three copies, two media, one off site), with the off-site copy out of the same building and the same power; test restores
- **Physical and access security:** controlled physical access, hardened management interfaces, disk encryption where the data needs it
- **People:** who is on call, who has remote hands or on-site access, and how long a hardware fault takes to fix
- **Hybrid links:** the link to a cloud or another site is redundant, encrypted, and sized and priced for the data that crosses it

### Checking them
In mode 2 prove what can be proven in the smoke build (it builds from the pinned artifact, starts with config from the environment, passes its health check, and the restore or rollback step runs once where the stage allows). In mode 3 re-check against the deployed environment and report each `## Practices` line you could confirm. Do not run a destructive drill (a failover, a delete, a restore over live data) without the Orchestrator's approval.

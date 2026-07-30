# Plan — Worker service (apps/worker)

## SESSION_CONTEXT_RETRIEVAL
> Building apps/worker: BullMQ processors for the content pipeline against the DONE foundation
> (@marketforge/{config,logger,contracts,db,queue,adapters}). Scope: create ONLY apps/worker/**.

## Pipeline transition map
research -> generate-text -> (generate-image ‖ ) -> review(fan-in) -> [human approval via API] -> publish -> analytics(delayed)
- review < 90 & regen left -> generate-text (attempt_reason=regeneration, cap 2)
- review pass or regen exhausted -> content_items.status='review' (await human approval; API enqueues publish)
- publish success -> analytics (Scheduler +1h); analytics reschedules +24h up to N
- terminal failure anywhere -> DLQ + notify + audit_log

## Tasks
- [x] Read all foundation contracts
- [x] package.json, tsconfig, tsup, vitest config, Dockerfile
- [x] src/lib: errors, failure (DLQ+notify+audit), readiness (content), n8n HMAC webhook, ai-runner, brand, json, health, constants, audit
- [x] src/agents: research, copywriter, image-prompt, reviewer + review-score (+ prompts/)
- [x] src/processors: research, generate-text, generate-image, review, publish, analytics, notify, generate-video, drive-mirror (+ base, index)
- [x] src/index.ts: boot (register all), health server, graceful shutdown
- [x] tests: review composite-score (7) + review processor (3) — 10 passing
- [x] typecheck PASS, build PASS, lint PASS

## Notes
- withTenant(db, orgId, tx=>...) for ALL tenant table access.
- logAiRun on EVERY adapters.llm/image/video call.
- content_items columns are drizzle camelCase; status values from ContentStatus enum.
- adapters singleton from @marketforge/adapters (stubs today).
</content>

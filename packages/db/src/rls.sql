-- ============================================================================
-- MarketForge — Row-Level Security (RLS) for multi-tenancy (ADR-001).
--
-- Shared Postgres schema; `org_id` on every tenant table. RLS is ENABLED and
-- FORCEd on all tenant tables. The application connects as a NON-BYPASSRLS
-- role and, per transaction, runs `SET LOCAL app.current_org = <uuid>` (via the
-- `withTenant` helper). Every policy filters rows by that GUC.
--
-- ROLE MODEL (create out-of-band; privileges vary per environment, so this file
-- does NOT create roles):
--
--   -- Owner/admin role that runs migrations and OWNS the tables:
--   --   (superuser or table owner) — NOT the role the app logs in as.
--   --
--   -- App role — MUST NOT have BYPASSRLS:
--   --   CREATE ROLE marketforge_app LOGIN PASSWORD '...' NOBYPASSRLS;
--   --   GRANT USAGE ON SCHEMA public TO marketforge_app;
--   --   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
--   --     TO marketforge_app;
--   --   ALTER DEFAULT PRIVILEGES IN SCHEMA public
--   --     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO marketforge_app;
--   -- Do NOT grant BYPASSRLS to marketforge_app. FORCE RLS also applies RLS to
--   -- the table owner, so even the owner is filtered unless explicitly excepted.
--
-- This file is idempotent: re-running drops and recreates the policy. It is
-- applied by `src/migrate.ts` AFTER drizzle's generated migrations.
-- ============================================================================

-- pgcrypto provides gen_random_uuid() used by the schema's PK defaults.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'org_memberships',
    'brands',
    'brand_knowledge',
    'contacts',
    'social_accounts',
    'campaigns',
    'content_items',
    'assets',
    'research_reports',
    'review_results',
    'publish_jobs',
    'analytics',
    'prompt_templates',
    'ai_agent_configs',
    'api_credentials',
    'audit_logs',
    'notifications'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    -- Skip tables that don't exist yet (defensive; migrations create them).
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE NOTICE 'RLS: table %.% missing, skipping', 'public', t;
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t
    );
    EXECUTE format(
      'ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', t
    );

    -- Idempotent: drop then (re)create the isolation policy.
    EXECUTE format(
      'DROP POLICY IF EXISTS tenant_isolation ON public.%I;', t
    );
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I '
      || 'USING (org_id = current_setting(''app.current_org'', true)::uuid) '
      || 'WITH CHECK (org_id = current_setting(''app.current_org'', true)::uuid);',
      t
    );
  END LOOP;
END
$$;

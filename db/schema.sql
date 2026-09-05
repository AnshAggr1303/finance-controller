-- AI Finance Controller — Supabase schema
--
-- Reconstructed from the live database via direct introspection
-- (pg_constraint, pg_indexes, pg_policies, pg_class) on 2026-09-05, not
-- from memory — see docs/PROJECT_STATUS.md for the verification this was
-- checked against. This file did not exist before that date; the schema
-- had only ever been applied by hand through the Supabase SQL Editor.
--
-- Run against a fresh Supabase project to reproduce the current live
-- schema, including:
--   - the review_candidates jsonb column on reconciliation_state
--   - uq_bank_row_claimed, the partial unique index that makes bank-row
--     claiming crash-safe (see backend/app/graph/matching.py)
--   - ON DELETE SET NULL on human_overrides.resolved_order_row_id /
--     resolved_bank_row_id — added after a real delete on the batches
--     table failed with a foreign key violation on the previous
--     no-action default (see PROJECT_STATUS.md "Known, accepted
--     limitations" for the incident and its verification)

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- batches
-- ---------------------------------------------------------------------
create table batches (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  label      text,
  created_at timestamptz not null default now()
);

alter table batches enable row level security;

create policy "Users manage own batches"
  on batches for all
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- raw_orders
-- ---------------------------------------------------------------------
create table raw_orders (
  id            uuid primary key default gen_random_uuid(),
  batch_id      uuid not null references batches(id) on delete cascade,
  order_id      text not null,
  amount        numeric not null,
  currency      text not null default 'INR',
  order_ts      timestamptz not null,
  customer_ref  text,
  raw_payload   jsonb,
  record_hash   text not null,
  true_match_id text,
  created_at    timestamptz not null default now(),
  unique (batch_id, record_hash)
);

create index idx_raw_orders_batch on raw_orders (batch_id);

alter table raw_orders enable row level security;

create policy "Users access own orders"
  on raw_orders for all
  using (batch_id in (select id from batches where user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- raw_bank_statements
-- ---------------------------------------------------------------------
create table raw_bank_statements (
  id            uuid primary key default gen_random_uuid(),
  batch_id      uuid not null references batches(id) on delete cascade,
  txn_id        text not null,
  amount        numeric not null,
  currency      text not null default 'INR',
  settled_ts    timestamptz not null,
  narration     text,
  raw_payload   jsonb,
  record_hash   text not null,
  true_match_id text,
  created_at    timestamptz not null default now(),
  unique (batch_id, record_hash)
);

create index idx_raw_bank_batch on raw_bank_statements (batch_id);

alter table raw_bank_statements enable row level security;

create policy "Users access own bank statements"
  on raw_bank_statements for all
  using (batch_id in (select id from batches where user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- reconciliation_state
--
-- order_row_id / bank_row_id already used ON DELETE SET NULL from the
-- start; only human_overrides' equivalent FKs (below) were missing it.
-- ---------------------------------------------------------------------
create table reconciliation_state (
  id                uuid primary key default gen_random_uuid(),
  batch_id          uuid not null references batches(id) on delete cascade,
  order_row_id      uuid references raw_orders(id) on delete set null,
  bank_row_id       uuid references raw_bank_statements(id) on delete set null,
  current_node      text not null,
  status            text not null default 'pending',
  confidence        numeric,
  updated_at        timestamptz not null default now(),
  review_candidates jsonb
);

create index idx_recon_batch on reconciliation_state (batch_id);
create index idx_recon_status on reconciliation_state (status);

-- Crash-safe bank-row claiming: a live query against this partial unique
-- index (not an in-memory set) is what lets matching.py resume safely
-- across a crashed and re-run batch without double-claiming a bank row.
create unique index uq_bank_row_claimed on reconciliation_state
  (batch_id, bank_row_id) where (status = 'matched');

alter table reconciliation_state enable row level security;

create policy "Users access own reconciliation state"
  on reconciliation_state for all
  using (batch_id in (select id from batches where user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- audit_trail
-- ---------------------------------------------------------------------
create table audit_trail (
  id                uuid primary key default gen_random_uuid(),
  reconciliation_id uuid not null references reconciliation_state(id) on delete cascade,
  node_name         text not null,
  decision_type     text not null,
  reasoning         text not null,
  confidence        numeric,
  created_at        timestamptz not null default now()
);

create index idx_audit_recon on audit_trail (reconciliation_id);

alter table audit_trail enable row level security;

create policy "Users access own audit trail"
  on audit_trail for all
  using (
    reconciliation_id in (
      select rs.id from reconciliation_state rs
      join batches b on b.id = rs.batch_id
      where b.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- human_overrides
--
-- resolved_order_row_id / resolved_bank_row_id originally had NO delete
-- action (the Postgres default), which blocked deleting a batch once any
-- human review had run against it -- verified live: `delete from batches
-- where id = ...` failed with a foreign key violation on
-- human_overrides_resolved_bank_row_id_fkey until this was fixed to
-- ON DELETE SET NULL, matching the same pattern already used by
-- reconciliation_state's equivalent columns above.
-- ---------------------------------------------------------------------
create table human_overrides (
  id                     uuid primary key default gen_random_uuid(),
  reconciliation_id      uuid not null references reconciliation_state(id) on delete cascade,
  raw_input              text not null,
  parsed_action          text,
  resolved_order_row_id  uuid references raw_orders(id) on delete set null,
  resolved_bank_row_id   uuid references raw_bank_statements(id) on delete set null,
  actor                  text not null default 'human',
  created_at             timestamptz not null default now()
);

create index idx_overrides_recon on human_overrides (reconciliation_id);

alter table human_overrides enable row level security;

create policy "Users access own overrides"
  on human_overrides for all
  using (
    reconciliation_id in (
      select rs.id from reconciliation_state rs
      join batches b on b.id = rs.batch_id
      where b.user_id = auth.uid()
    )
  );

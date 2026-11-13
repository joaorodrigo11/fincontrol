-- Test connections and snapshots are intentionally separate from financial ledgers.
create table public.bank_sandbox_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null unique,
  institution_name text not null check (char_length(institution_name) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.bank_sandbox_snapshots (
  connection_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  accounts jsonb not null default '[]'::jsonb check (jsonb_typeof(accounts) = 'array'),
  transactions jsonb not null default '[]'::jsonb check (jsonb_typeof(transactions) = 'array'),
  updated_at timestamptz not null default now(),
  primary key (connection_id, month),
  foreign key (connection_id, user_id) references public.bank_sandbox_connections(id, user_id) on delete cascade
);

alter table public.bank_sandbox_connections enable row level security;
alter table public.bank_sandbox_snapshots enable row level security;
revoke all on public.bank_sandbox_connections, public.bank_sandbox_snapshots from anon, authenticated;
grant select on public.bank_sandbox_connections, public.bank_sandbox_snapshots to authenticated;
grant all on public.bank_sandbox_connections, public.bank_sandbox_snapshots to service_role;
create policy "Read own sandbox connections" on public.bank_sandbox_connections for select to authenticated using ((select auth.uid()) = user_id);
create policy "Read own sandbox snapshots" on public.bank_sandbox_snapshots for select to authenticated using ((select auth.uid()) = user_id);
-- Writes are only possible through the authenticated, ownership-checked Edge Function.

-- Link manual entries to one bank account without changing provider snapshots.
alter table public.transactions
  add column bank_connection_id uuid,
  add column bank_account_id text,
  add column bank_reflected boolean not null default false,
  add constraint transactions_bank_account_length check (bank_account_id is null or char_length(bank_account_id) between 1 and 200),
  add constraint transactions_bank_account_required check (bank_connection_id is null or bank_account_id is not null),
  add constraint transactions_bank_connection_owner
    foreign key (bank_connection_id, user_id)
    references public.bank_sandbox_connections(id, user_id)
    on delete set null (bank_connection_id);

create index transactions_bank_connection_idx
  on public.transactions(user_id, bank_connection_id)
  where bank_connection_id is not null;

-- Existing RLS policies continue to restrict entries to their owner.
-- Existing entries remain unlinked; never guess which account they belong to.
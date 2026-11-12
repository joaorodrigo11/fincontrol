-- Tabela de Orçamento Mensal Individual por Usuário
create table public.monthly_budgets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  month_year text not null, -- Formato "YYYY-MM" (ex: "2026-11")
  available_cash numeric(12,2) default 0 not null, -- Salário / Dinheiro disponível
  credit_limit numeric(12,2) default 0 not null,   -- Limite de crédito disponível
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, month_year)
);

-- Tabela de Transações, Parcelas e Previsões
create table public.transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  installment_group_id uuid, -- Agrupa parcelas de uma mesma compra
  title text not null,
  amount numeric(12,2) not null,
  type text check (type in ('income', 'expense')) not null,
  payment_method text check (payment_method in ('pix', 'debit', 'credit_card', 'cash')) not null,
  status text check (status in ('paid', 'pending', 'planned')) not null, -- 'paid' (Feito), 'pending' (Fatura), 'planned' (Previsto)
  category text not null,
  date date not null, -- Formato "YYYY-MM-DD"
  installment_current integer, -- Ex: 1
  installment_total integer,   -- Ex: 10
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ativar Row Level Security (RLS) para isolamento total entre usuários
alter table public.monthly_budgets enable row level security;
alter table public.transactions enable row level security;

-- Políticas de Segurança: cada usuário só vê, cria, edita e deleta seus próprios dados
create policy "Usuários gerenciam apenas seus próprios orçamentos"
  on public.monthly_budgets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Usuários gerenciam apenas suas próprias transações"
  on public.transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

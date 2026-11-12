# Meus Gastos, Minha Vida — Especificação Técnica para Desenvolvimento (SPA + Supabase + Google Auth)

## 1. Visão Geral do Projeto
* **Objetivo:** Desenvolver uma Single Page Application (SPA) de controle financeiro pessoal e individual para os membros da família. Cada usuário acessa sua própria conta utilizando login via Google (Gmail) e visualiza exclusivamente seu próprio dashboard financeiro na nuvem.
* **Funcionalidades Core:** Gerenciar o orçamento disponível do mês (separando salário/dinheiro em conta de limite de crédito), registrar gastos via Pix/Débito já realizados, lançar compras parceladas que se projetam automaticamente nos meses seguintes, cadastrar gastos previstos futuros e analisar onde estão os maiores gastos.
* **Tipo de Aplicação:** Web App SPA responsivo (Mobile-First e Desktop) com persistência em nuvem.

## 2. Stack Tecnológica Obrigatória
Utilize exatamente as seguintes tecnologias:
* **Framework Frontend:** React (com Vite) + TypeScript
* **Estilização:** Tailwind CSS
* **Componentes UI & Ícones:** Shadcn/UI (ou componentes limpos em Tailwind) + Lucide React
* **Gráficos:** Recharts (para ranking de maiores gastos, evolução mensal e projeção futura)
* **Backend, Banco de Dados & Autenticação:** Supabase (`@supabase/supabase-js`)
  * **Auth:** Google OAuth Provider (Login com Gmail).
  * **Database:** PostgreSQL com **Row Level Security (RLS)** ativado para garantir privacidade total entre as contas.
* **Datas e Moeda:** `date-fns` (com locale `ptBR`) e `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.

## 3. Configuração do Banco de Dados (Supabase SQL Schema)
Gere um arquivo `supabase/schema.sql` contendo a criação das tabelas e políticas de segurança (RLS) abaixo:

```sql
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
```

## 4. Estrutura de Pastas Sugerida
```text
/supabase
  schema.sql        # Script SQL completo para rodar no Supabase
/src
  /components
    /auth           # Tela de Login com botão "Entrar com Google" e proteção de rota
    /ui             # Botões, inputs, modais, barras de progresso, toasts
    /dashboard      # Cards de Saldo Livre, Crédito Disponível, Projeção e Gráficos
    /transactions   # Formulário inteligente (À vista vs Parcelado), Tabela e Filtros
  /context          # AuthContext (sessão Google) e FinanceContext (dados do Supabase)
  /lib              # supabaseClient.ts (configuração via variáveis de ambiente)
  /types            # Interfaces TypeScript mapeadas com o banco
  /utils            # Cálculos de parcelas futuras, formatadores BRL e helpers
  App.tsx           # Gerenciador de rotas/visões SPA
  main.tsx
```

## 5. Funcionalidades e Regras de Negócio

### Módulo 1: Autenticação Individual via Google (Gmail)
* Se o usuário não estiver autenticado, exibir uma tela de boas-vindas limpa com o botão **"Entrar com Google"** (`supabase.auth.signInWithOAuth({ provider: 'google' })`).
* Após o login, carregar a foto de perfil e o nome do Google no cabeçalho da SPA junto com um botão **"Sair"**.
* Garantir que todas as requisições ao banco enviem automaticamente o `user_id` do usuário logado.

### Módulo 2: Orçamento Mensal (Salário vs. Crédito Disponível)
* No topo do Dashboard do mês selecionado (`< Novembro 2026 >`), permitir inserir e editar:
  * **Salário / Dinheiro Disponível no Mês:** Valor base em conta.
  * **Crédito Disponível no Mês:** Limite estipulado para o cartão de crédito.
* **Cálculos Automáticos em Tempo Real:**
  * **Saldo Livre em Conta:** `(Salário Base + Entradas Extras) - (Gastos pagos via Pix, Débito e Dinheiro)`.
  * **Crédito Restante:** `Crédito Disponível do Mês - (Soma das compras e parcelas no Crédito deste mês)`.
  * Exibir barras de progresso visuais com alertas (amarelo ao atingir 80% do limite, vermelho ao ultrapassar 100%).

### Módulo 3: Lançamento Inteligente (Pix, À Vista, Parcelado e Previsto)
* Formulário/Modal para adicionar movimentação com os campos:
  * **Descrição** (ex: "Mercado", "Pix Aluguel", "Notebook")
  * **Valor** (em R$)
  * **Tipo:** Despesa (`expense`) ou Entrada Extra (`income`)
  * **Forma de Pagamento:** Pix (`pix`), Débito (`debit`), Cartão de Crédito (`credit_card`) ou Dinheiro (`cash`).
  * **Situação:** "Já realizado / Pago" (`paid`) ou "Gasto Previsto" (`planned`).
  * **Parcelamento:** Número de parcelas (padrão `1x`).
* **Regra de Geração Automática de Parcelas:**
  * Ao lançar um gasto parcelado (ex: `R$ 1.200,00` em `6x`), o sistema deve criar **6 registros simultâneos** no Supabase (`insert` em lote) de `R$ 200,00`, avançando 1 mês na data de cada parcela, todos ligados pelo mesmo `installment_group_id` (`Parcela 1/6`, `2/6`... `6/6`).
  * Ao excluir uma parcela, exibir opção para excluir *"somente esta parcela"* ou *"esta e todas as parcelas futuras"* (filtrando pelo `installment_group_id`).

### Módulo 4: Projeção dos Próximos Meses
* Aba ou seção **"Próximos Meses"** exibindo um **Gráfico de Barras Empilhadas** para os próximos 6 a 12 meses, separando:
  1. Total comprometido com **parcelas já lançadas**.
  2. Total de **gastos previstos** (`planned`).
* Mostrar o resumo numérico mês a mês para o usuário saber quanto da renda futura já está comprometida.

### Módulo 5: Diagnóstico — Onde Estão os Maiores Gastos
* **Gráfico de Rosca e Ranking por Categoria:** Lista ordenada da categoria que mais consome dinheiro para a que menos consome (valor em R$ e % do total).
* **Top 5 Maiores Gastos do Mês:** Destaque visual para as 5 maiores despesas ou parcelas individuais do mês selecionado.

## 6. Variáveis de Ambiente Necessárias
Crie um arquivo `.env.example` na raiz com:
```env
VITE_SUPABASE_URL=sua_url_do_projeto_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anon_publica_supabase
```

## 7. Instruções de Execução para a IA
1. Instale as dependências: `@supabase/supabase-js`, `lucide-react`, `recharts`, `date-fns`.
2. Gere o arquivo `/supabase/schema.sql` exato conforme especificado na Seção 3.
3. Configure o `/src/lib/supabaseClient.ts` e o `AuthContext.tsx` com suporte ao login via Google OAuth.
4. Implemente o `FinanceContext.tsx` conectado às tabelas `monthly_budgets` e `transactions` do Supabase, incluindo a lógica de inserção em lote para compras parceladas.
5. Construa toda a interface responsiva em **Português do Brasil (pt-BR)** com formatação monetária `R$ 0.000,00` e estados de carregamento (loaders) durante chamadas ao banco.

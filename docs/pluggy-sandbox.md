# Pluggy no Lôro — primeira etapa em ambiente de testes

Esta implementação conecta **somente o Sandbox (conector 2)** da Pluggy. A área **Bancos** permite criar uma conexão fictícia, consultar contas, buscar transações do mês selecionado, consultar a última sincronização e desconectar. A sincronização é manual, pelo botão **Sincronizar mês**. Não há polling contínuo, webhook ou agendamento nesta etapa.

As prévias ficam nas tabelas `bank_sandbox_connections` e `bank_sandbox_snapshots`. **Nenhuma transação fictícia é inserida em `transactions` e nenhum orçamento é alterado.** O Lorômetro, a carteira, os cálculos e os lançamentos reais continuam usando os contextos originais. Dados reais, conciliação de lançamentos manuais, pagamentos de fatura e importação definitiva exigem uma etapa posterior, após habilitação e testes com o provedor.

## 1. Credenciais e origens permitidas

No projeto do Supabase usado pelo Lôro, abra **Edge Functions → Secrets** e cadastre:

| Nome | Valor |
| --- | --- |
| `PLUGGY_CLIENT_ID` | Client ID da aplicação criada na Pluggy |
| `PLUGGY_CLIENT_SECRET` | Client Secret da aplicação criada na Pluggy |
| `LORO_ALLOWED_ORIGINS` | Endereços exatos do Lôro, separados por vírgula, sem barra final |

Exemplo de `LORO_ALLOWED_ORIGINS`:

```text
http://localhost:5173,http://localhost:5174,https://seu-loro.vercel.app
```

Substitua o endereço de produção pelo domínio verdadeiro. Sem uma origem autorizada, a função recusa a chamada. Não use `*`. Os secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já são disponibilizados pelo Supabase às Edge Functions; não os copie para o frontend.

**Não crie variáveis `VITE_PLUGGY_*`. Não coloque credenciais no GitHub, no chat nem nas variáveis públicas da Vercel.** Somente um Connect Token temporário é devolvido ao navegador.

## 2. Banco de dados

No **SQL Editor** do Supabase, execute uma vez o arquivo:

```text
supabase/migrations/202611120001_pluggy_sandbox.sql
```

A migração cria duas tabelas novas, com RLS e leitura limitada ao proprietário. O usuário comum não tem permissão para gravar diretamente nas tabelas. Ela não altera as tabelas financeiras existentes.

## 3. Publicar a Edge Function

A função tem três arquivos: `index.ts`, `handler.ts` e `policy.ts`, no diretório `supabase/functions/pluggy/`. Pelo terminal autenticado no Supabase:

```powershell
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase functions deploy pluggy
```

O `project-ref` identifica o projeto da URL do Supabase. Não é uma senha. A opção `verify_jwt = false` está restrita à função `pluggy` no `supabase/config.toml`: **não significa acesso anônimo**. A função exige `Authorization: Bearer …` e valida a sessão em `/auth/v1/user` em todas as chamadas, antes de acessar dados ou a Pluggy. Isso também atende projetos com chaves de assinatura assimétricas.

Se publicar pelo editor do Dashboard, preserve os três arquivos e as importações relativas e desative apenas a verificação JWT legada do gateway para essa função; a validação explícita da sessão deve permanecer no código.

## 4. Testar no Lôro

1. Publique a versão atualizada do frontend e entre com Google.
2. Abra **Bancos** na barra lateral; no celular, a seção fica no final do painel.
3. Use **Atualizar conexões** se a configuração acabou de ser concluída.
4. Clique em **Conectar banco de teste**. O widget oficial da Pluggy oferece somente a instituição Sandbox.
5. Use as credenciais fictícias exibidas no guia Sandbox da Pluggy (cenário `user-ok` / `password-ok`). Não forneça senhas bancárias reais.
6. Após conectar, clique em **Sincronizar mês**. Se a instituição ainda estiver processando a conexão, aguarde e tente novamente.
7. Confira as contas e as transações. Sincronize novamente: a mesma conexão/mês é substituída, e IDs de transação repetidos são eliminados.
8. Troque o mês no cabeçalho. Uma consulta antiga não é mostrada como se pertencesse ao novo mês; sincronize o mês escolhido quando necessário.
9. Entre com outra conta Google e confira que as conexões e os dados não aparecem para ela.

Valores e sinais são preservados como retornados pela Pluggy. Nas contas de cartão, um valor positivo pode representar aumento de dívida, enquanto um pagamento aparece negativo. A prévia não transforma pagamentos de fatura em novas despesas e não expande parcelas.

## Proteções implementadas

- Sessão verificada no servidor em cada ação; nunca confia em um `user_id` enviado pelo navegador.
- `clientUserId` atribuído pelo servidor ao emitir o Connect Token e verificado ao associar e sincronizar o Item.
- Registro local do Item e consulta por proprietário; não depende de um endpoint global de listagem de Items.
- Recusa Items de terceiros e conectores reais, mesmo que um cliente altere o formulário.
- Apenas o servidor tem a API key da Pluggy e a chave administrativa do Supabase.
- Lista fechada de origens CORS; respostas sem cache; timeouts, limite de páginas/contas/transações e mensagens sem credenciais.
- Paginação não pode mudar de domínio, endpoint, conta ou período.
- Falhas de paginação não salvam snapshots parciais. A sincronização repetida não cria cópias de transações.
- Desconectar remove o Item na Pluggy e os snapshots locais da conexão. Se o Item de teste já expirou na Pluggy, a referência local ainda pode ser removida.

## Verificação local

```powershell
npm run build
npm run lint
npm test
npx deno check supabase/functions/pluggy/index.ts
```

Os testes automatizados usam respostas simuladas e verificam isolamento, autenticação, secrets ausentes, recusa de bancos reais, paginação, sinais, duplicidade e falhas de sincronização. Eles não comprovam a migração aplicada, a configuração do projeto remoto, o widget hospedado ou o acesso real ao provedor. Faça esses testes após a publicação.

## Referências oficiais

- [Pluggy Quick Start](https://v2.docs.pluggy.ai/en/docs/quickstart)
- [Autenticação e Connect Token](https://v2.docs.pluggy.ai/en/reference/authentication)
- [Widget e Sandbox](https://docs.pluggy.ai/en/docs/connect-widget/environments)
- [Transações e convenção de sinais](https://v2.docs.pluggy.ai/en/docs/products/transactions)
- [Secrets das Edge Functions](https://supabase.com/docs/guides/functions/secrets)
- [Autenticação das Edge Functions](https://supabase.com/docs/guides/functions/auth)

# Mercado Pago Sync PoC para Actual Budget

Este script é uma **Prova de Conceito (PoC)** e conector standalone para sincronizar movimentações bancárias de pessoa física da API do **Mercado Pago** diretamente para o **Actual Budget** via `@actual-app/api`.

---

## 1. Mapeamento de Endpoints

### Endpoint de Extrato Pessoal: `/v1/account/movements/search`

Diferente do endpoint de vendas e checkouts comerciais (`/v1/payments/search`), contas pessoais utilizam `/v1/account/movements/search` para listar transações de extrato (PIX, boletos, compras no débito, retiradas e rendimentos).

#### Parâmetros Suportados:

- `range`: `date_created` (padrão) ou `date_released`
- `begin_date`: Data de início no formato ISO 8601 (ex: `2026-08-01T00:00:00Z`)
- `end_date`: Data de término no formato ISO 8601 (ex: `2026-08-27T23:59:59Z`)
- `limit`: Quantidade de itens por página (máximo 50)
- `offset`: Deslocamento para paginação

#### Tipos de Movimentações Catalogadas:

| Tipo (`type`)                           | Descrição no Actual                         | Direção / Valor         |
| --------------------------------------- | ------------------------------------------- | ----------------------- |
| `pix_transfer_in`                       | Transferência recebida via PIX              | Entrada (+)             |
| `pix_transfer_out`                      | Transferência enviada via PIX               | Saída (-)               |
| `bill_payment`                          | Pagamento de boleto bancário                | Saída (-)               |
| `card_payment`                          | Compra no cartão físico / virtual de débito | Saída (-)               |
| `ted_transfer_in` / `doc_transfer_in`   | TED / DOC recebido                          | Entrada (+)             |
| `ted_transfer_out` / `doc_transfer_out` | TED / DOC enviado                           | Saída (-)               |
| `fee`                                   | Tarifas de serviço Mercado Pago             | Saída (-)               |
| `atm_withdrawal`                        | Saque em dinheiro (Banco24Horas)            | Saída (-)               |
| `yield` / `investment_yield`            | Rendimento diário 100% CDI                  | Entrada (+) ou Filtrado |

---

## 2. Tratamento de Rendimentos de Saldo (CDI)

O Mercado Pago gera lançamentos diários de centavos referentes ao rendimento automático da conta. O script oferece 3 estratégias via variável de ambiente `YIELD_HANDLING`:

1. `ignore` (Padrão): Ignora micro-rendimentos para não poluir o extrato e orçamento.
2. `import`: Importa cada rendimento individualmente como receita com o beneficiário `Mercado Pago - Rendimento CDI`.
3. `group_daily`: Agrupa todos os rendimentos de um mesmo dia em um único lançamento consolidado por data.

---

## 3. Como Obter o Access Token do Mercado Pago

1. Acesse o [Painel de Desenvolvedores do Mercado Pago](https://www.mercadopago.com/developers).
2. Vá em **Suas integrações** e crie uma aplicação (ou selecione uma existente).
3. Em **Credenciais de Produção**, copie o seu `Access Token` pessoal (começa com `APP_USR-...`).
4. **Segurança:** Nunca compartilhe nem submeta esse token ao repositório git. Utilize variáveis de ambiente.

---

## 4. Variáveis de Ambiente e Configuração

Crie um arquivo `.env` ou exporte as seguintes variáveis no terminal:

```bash
# Credenciais do Mercado Pago
export MP_ACCESS_TOKEN="APP_USR-xxxx-xxxx-xxxx"

# Configurações do Actual Budget
export ACTUAL_SERVER_URL="http://localhost:5006"
export ACTUAL_PASSWORD="sua-senha-do-servidor"
export ACTUAL_SYNC_ID="seu-sync-id"          # Encontrado em Configurações > Arquivo > Sync ID
export ACTUAL_ACCOUNT_ID="id-da-conta-no-actual" # ID da conta no Actual onde os lançamentos serão criados

# Preferências Opcionais
export YIELD_HANDLING="ignore"                # Opções: "ignore", "import", "group_daily"
export YIELD_PAYEE_NAME="Mercado Pago - Rendimento CDI"
export DAYS_TO_SYNC=30                        # Quantidade de dias retroativos para buscar
export MOCK_MODE=false                        # Defina como "true" para testar com dados simulados
```

---

## 5. Executando o Script

### Modo de Teste / Mock (Sem credenciais ativas)

```bash
MOCK_MODE=true yarn tsx scripts/mercadopago-sync/sync.ts
```

### Modo de Produção / Sincronização Real

```bash
yarn tsx scripts/mercadopago-sync/sync.ts
```

### Rodando os Testes Automatizados

```bash
yarn vitest run scripts/mercadopago-sync/client.test.ts
```

import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type * as ActualApi from '@actual-app/api';

import { MercadoPagoClient } from './client.ts';
import { normalizeMovements } from './normalizer.ts';
import type { MercadoPagoMovement, SyncConfig } from './types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const apiDistPath = path.resolve(__dirname, '../../packages/api/dist/index.js');
if (!fs.existsSync(apiDistPath)) {
  throw new Error(
    'O bundle do @actual-app/api não foi encontrado. Por favor, execute `yarn workspace @actual-app/api build` antes de rodar o sync.',
  );
}

const actual: typeof ActualApi = require(apiDistPath);

// Sample mock movements for testing without active MP credentials
export const MOCK_MOVEMENTS: MercadoPagoMovement[] = [
  {
    id: 'mov_1001',
    date_created: '2026-08-25T10:15:00.000-03:00',
    type: 'pix_transfer_in',
    status: 'approved',
    detail: 'Transferência recebida via PIX',
    financial_entity: 'Maria Silva',
    amount: 150.0,
    reference_id: 'PIX-REQ-987123',
  },
  {
    id: 'mov_1002',
    date_created: '2026-08-25T14:30:00.000-03:00',
    type: 'bill_payment',
    status: 'approved',
    detail: 'Pagamento de conta de luz',
    description: 'Enel Distribuição São Paulo',
    financial_entity: 'Enel SP',
    amount: 124.5,
    reference_id: 'BOL-882319',
  },
  {
    id: 'mov_1003',
    date_created: '2026-08-26T08:00:00.000-03:00',
    type: 'yield',
    status: 'approved',
    detail: 'Rendimento de saldo 100% CDI',
    amount: 0.35,
    reference_id: 'YIELD-20260826',
  },
  {
    id: 'mov_1004',
    date_created: '2026-08-26T18:45:00.000-03:00',
    type: 'card_payment',
    status: 'approved',
    detail: 'Supermercado Pão de Açúcar',
    financial_entity: 'Pao de Acucar Loja 12',
    amount: 89.9,
    reference_id: 'DEB-771234',
  },
  {
    id: 'mov_1005',
    date_created: '2026-08-27T09:20:00.000-03:00',
    type: 'pix_transfer_out',
    status: 'approved',
    detail: 'Transferência PIX para João Souza',
    financial_entity: 'João Souza',
    amount: 45.0,
    reference_id: 'PIX-OUT-554433',
  },
];

export function getSyncConfigFromEnv(): SyncConfig {
  // If MP_ACCESS_TOKEN is not in environment, try loading from local .env
  if (!process.env.MP_ACCESS_TOKEN) {
    try {
      const localEnvPath = path.resolve(__dirname, '.env');
      const rootEnvPath = path.resolve('scripts/mercadopago-sync/.env');
      const envPath = fs.existsSync(localEnvPath)
        ? localEnvPath
        : fs.existsSync(rootEnvPath)
          ? rootEnvPath
          : path.resolve('.env');

      if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf8').split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [k, ...v] = trimmed.split('=');
            if (k && !process.env[k.trim()]) {
              process.env[k.trim()] = v
                .join('=')
                .trim()
                .replace(/^["']|["']$/g, '');
            }
          }
        }
      }
    } catch {
      // Ignore env file read errors
    }
  }

  return {
    mercadopagoAccessToken: process.env.MP_ACCESS_TOKEN || '',
    actualServerUrl: process.env.ACTUAL_SERVER_URL || 'http://localhost:5006',
    actualPassword: process.env.ACTUAL_PASSWORD || '',
    actualSyncId: process.env.ACTUAL_SYNC_ID || '',
    actualAccountId: process.env.ACTUAL_ACCOUNT_ID || '',
    dataDir: process.env.ACTUAL_DATA_DIR || './.actual-cache',
    yieldHandling:
      (process.env.YIELD_HANDLING as SyncConfig['yieldHandling']) || 'ignore',
    yieldPayeeName:
      process.env.YIELD_PAYEE_NAME || 'Mercado Pago - Rendimento CDI',
    daysToSync: parseInt(process.env.DAYS_TO_SYNC || '30', 10),
  };
}

export async function runSync(
  config: SyncConfig,
  options: { isMock?: boolean; movements?: MercadoPagoMovement[] } = {},
) {
  console.log('--- Iniciando Sincronização Mercado Pago -> Actual Budget ---');

  let rawMovements: MercadoPagoMovement[] = [];

  if (
    options.isMock ||
    process.env.MOCK_MODE === 'true' ||
    !config.mercadopagoAccessToken
  ) {
    console.log('⚡ Modo Mock ativado: utilizando dados de teste simulados.');
    rawMovements = options.movements || MOCK_MOVEMENTS;
  } else {
    console.log('🔍 Conectando à API do Mercado Pago...');
    const client = new MercadoPagoClient(config.mercadopagoAccessToken);

    const endDate = new Date().toISOString();
    const beginDate = new Date(
      Date.now() - (config.daysToSync || 30) * 24 * 60 * 60 * 1000,
    ).toISOString();

    console.log(
      `📅 Período de busca: ${beginDate.split('T')[0]} até ${endDate.split('T')[0]}`,
    );
    rawMovements = await client.fetchAllMovements({ beginDate, endDate });
  }

  console.log(
    `📦 ${rawMovements.length} movimentações obtidas do Mercado Pago.`,
  );

  // Normalização
  const normalized = normalizeMovements(rawMovements, {
    actualAccountId: config.actualAccountId,
    yieldHandling: config.yieldHandling,
    yieldPayeeName: config.yieldPayeeName,
  });

  console.log(
    `✨ ${normalized.length} transações normalizadas para o formato do Actual Budget.`,
  );

  // Se não houver conta do Actual configurada ou estiver apenas em dry-run
  if (!config.actualAccountId) {
    console.log(
      '⚠️ Nenhuma conta (ACTUAL_ACCOUNT_ID) configurada. Prévia das transações:',
    );
    console.dir(normalized, { depth: null });
    return normalized;
  }

  // Conexão com o Actual Budget via @actual-app/api
  console.log('🚀 Inicializando @actual-app/api...');
  const dataDir = path.resolve(config.dataDir || './.actual-cache');
  fs.mkdirSync(dataDir, { recursive: true });

  const initConfig: Parameters<typeof actual.init>[0] =
    config.actualServerUrl && config.actualPassword
      ? {
          serverURL: config.actualServerUrl,
          password: config.actualPassword,
          dataDir,
        }
      : {
          dataDir,
        };
  await actual.init(initConfig);

  try {
    let syncId = config.actualSyncId;

    if (!syncId) {
      const budgets = (await actual.getBudgets()) as Array<{
        groupId?: string;
        cloudFileId?: string;
        id?: string;
        name: string;
      }>;

      if (!budgets || budgets.length === 0) {
        throw new Error(
          'Nenhum orçamento encontrado no servidor do Actual Budget. Configure o ACTUAL_SYNC_ID no .env.',
        );
      }

      syncId =
        budgets[0].groupId || budgets[0].cloudFileId || budgets[0].id || '';
      console.log(
        `ℹ️ ACTUAL_SYNC_ID não configurado. Utilizando automaticamente o orçamento "${budgets[0].name}" (Sync ID: ${syncId})`,
      );
    }

    console.log(`📥 Carregando/Baixando orçamento (${syncId})...`);
    await actual.downloadBudget(syncId);

    // Validação da conta destino
    const accounts = await actual.getAccounts();
    const targetAccount = accounts.find(
      (acc: { id: string; name: string }) => acc.id === config.actualAccountId,
    );

    if (!targetAccount) {
      const accountsList = accounts
        .map((a: { name: string; id: string }) => `  - ${a.name} (ID: ${a.id})`)
        .join('\n');
      throw new Error(
        `A conta com ID "${config.actualAccountId}" não foi encontrada no orçamento.\nContas disponíveis:\n${accountsList}`,
      );
    }

    console.log(`🎯 Conta destino identificada: "${targetAccount.name}"`);

    if (normalized.length > 0) {
      console.log(
        `📥 Importando ${normalized.length} transações na conta "${targetAccount.name}"...`,
      );
      const result = await actual.importTransactions(
        config.actualAccountId,
        normalized,
      );
      console.log('✅ Resultado da importação:', result);

      console.log('🔄 Sincronizando alterações com o servidor...');
      await actual.sync();
    } else {
      console.log('ℹ️ Nenhuma transação pendente para importação.');
    }
  } finally {
    await actual.shutdown();
    console.log('🏁 Processo finalizado.');
  }
}

// Se executado diretamente via terminal
if (
  typeof process !== 'undefined' &&
  process.argv &&
  process.argv[1]?.endsWith('sync.ts')
) {
  const config = getSyncConfigFromEnv();
  runSync(config).catch(err => {
    console.error('❌ Erro na execução:', err);
    process.exit(1);
  });
}

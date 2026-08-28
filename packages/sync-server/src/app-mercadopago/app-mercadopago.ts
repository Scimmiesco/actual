import express from 'express';

import { isAdmin } from '#account-db';
import { handleError } from '#app-gocardless/util/handle-error';
import * as UserService from '#services/user-service';
import {
  requestLoggerMiddleware,
  validateSessionMiddleware,
} from '#util/middlewares';
import { isValidFileId } from '#util/paths';

import { mercadopagoService } from './mercadopago-service';

const app = express();
export { app as handlers };

app.use(requestLoggerMiddleware);
app.use(express.json());
app.use(validateSessionMiddleware);

function canAccessFile(fileId: string, userId: string): boolean {
  return isAdmin(userId) || UserService.countUserAccess(fileId, userId) > 0;
}

app.post(
  '/status',
  handleError(async (req, res) => {
    const fileId = req.get('X-Actual-File-Id');
    if (fileId) {
      if (!isValidFileId(fileId)) {
        res.status(400).send({
          status: 'error',
          reason: 'invalid-file-id',
          details: 'invalid fileId',
        });
        return;
      }

      if (!canAccessFile(fileId, res.locals.user_id)) {
        res.status(403).send({
          status: 'error',
          reason: 'file-access-denied',
          details: "You don't have permissions over this file",
        });
        return;
      }
    }

    const source = mercadopagoService.getCredentialSource(fileId || null);

    res.send({
      status: 'ok',
      data: {
        configured: !!source,
        source,
      },
    });
  }),
);

app.post(
  '/config',
  handleError(async (req, res) => {
    const fileId = req.get('X-Actual-File-Id');
    if (fileId) {
      if (!isValidFileId(fileId)) {
        res.status(400).send({
          status: 'error',
          reason: 'invalid-file-id',
          details: 'invalid fileId',
        });
        return;
      }

      if (!canAccessFile(fileId, res.locals.user_id)) {
        res.status(403).send({
          status: 'error',
          reason: 'file-access-denied',
          details: "You don't have permissions over this file",
        });
        return;
      }
    }

    const { accessToken } = req.body || {};
    if (!accessToken || typeof accessToken !== 'string') {
      res.status(400).send({
        status: 'error',
        reason: 'invalid-access-token',
        details: 'Access token is required',
      });
      return;
    }

    try {
      const result = await mercadopagoService.saveCredentials({
        accessToken: accessToken.trim(),
        fileId: fileId || null,
      });

      res.send({
        status: 'ok',
        data: {
          user: result.user,
          configured: true,
        },
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(400).send({
        status: 'error',
        reason: 'authentication-failed',
        details: errorMsg,
      });
    }
  }),
);

app.post(
  '/accounts',
  handleError(async (req, res) => {
    const fileId = req.get('X-Actual-File-Id');
    if (fileId) {
      if (!isValidFileId(fileId)) {
        res.status(400).send({
          status: 'error',
          reason: 'invalid-file-id',
          details: 'invalid fileId',
        });
        return;
      }

      if (!canAccessFile(fileId, res.locals.user_id)) {
        res.status(403).send({
          status: 'error',
          reason: 'file-access-denied',
          details: "You don't have permissions over this file",
        });
        return;
      }
    }

    const source = mercadopagoService.getCredentialSource(fileId || null);
    if (!source) {
      res.status(400).send({
        status: 'error',
        reason: 'not-configured',
        details: 'Mercado Pago credentials are not configured',
      });
      return;
    }

    try {
      const accounts = await mercadopagoService.getAccounts(fileId || null);
      res.send({
        status: 'ok',
        data: {
          accounts,
        },
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).send({
        status: 'error',
        reason: 'provider-error',
        details: errorMsg,
      });
    }
  }),
);

app.post(
  '/transactions',
  handleError(async (req, res) => {
    const fileId = req.get('X-Actual-File-Id');
    if (fileId) {
      if (!isValidFileId(fileId)) {
        res.status(400).send({
          status: 'error',
          reason: 'invalid-file-id',
          details: 'invalid fileId',
        });
        return;
      }

      if (!canAccessFile(fileId, res.locals.user_id)) {
        res.status(403).send({
          status: 'error',
          reason: 'file-access-denied',
          details: "You don't have permissions over this file",
        });
        return;
      }
    }

    const source = mercadopagoService.getCredentialSource(fileId || null);
    if (!source) {
      res.status(400).send({
        status: 'error',
        reason: 'not-configured',
        details: 'Mercado Pago credentials are not configured',
      });
      return;
    }

    const { accountId, startDate, endDate } = req.body || {};

    try {
      const data = await mercadopagoService.getTransactionsByAccountId({
        accountId,
        startDate,
        endDate,
        fileId: fileId || null,
      });

      res.send({
        status: 'ok',
        data,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).send({
        status: 'error',
        reason: 'provider-error',
        details: errorMsg,
      });
    }
  }),
);


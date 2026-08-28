import type {
  MercadoPagoMovement,
  MercadoPagoMovementsResponse,
  MercadoPagoSearchOptions,
} from './types';

export class MercadoPagoClient {
  private accessToken: string;
  private baseUrl: string;

  constructor(accessToken: string, baseUrl = 'https://api.mercadopago.com') {
    this.accessToken = accessToken;
    this.baseUrl = baseUrl;
  }

  /**
   * Search personal account movements or payments
   */
  async searchMovements(
    options: MercadoPagoSearchOptions = {},
  ): Promise<MercadoPagoMovementsResponse> {
    const params = new URLSearchParams();

    if (options.limit) {
      params.append('limit', String(options.limit));
    }
    if (options.offset !== undefined) {
      params.append('offset', String(options.offset));
    }
    if (options.beginDate) {
      params.append('begin_date', options.beginDate);
    }
    if (options.endDate) {
      params.append('end_date', options.endDate);
    }
    if (options.range) {
      params.append('range', options.range);
    } else {
      params.append('range', 'date_created');
    }

    const movementUrl = `${this.baseUrl}/v1/account/movements/search?${params.toString()}`;

    const movementResponse = await fetch(movementUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (movementResponse.ok) {
      const data =
        (await movementResponse.json()) as MercadoPagoMovementsResponse;
      return data;
    }

    // If movement search endpoint returned 404 (e.g. test credentials or standard API access),
    // fall back to /v1/payments/search which is available on all accounts
    if (movementResponse.status === 404) {
      const paymentParams = new URLSearchParams();
      if (options.limit) paymentParams.append('limit', String(options.limit));
      if (options.offset !== undefined) {
        paymentParams.append('offset', String(options.offset));
      }
      if (options.beginDate) {
        paymentParams.append('begin_date', options.beginDate);
      }
      if (options.endDate) paymentParams.append('end_date', options.endDate);
      paymentParams.append('sort', 'date_created');
      paymentParams.append('criteria', 'desc');

      const paymentUrl = `${this.baseUrl}/v1/payments/search?${paymentParams.toString()}`;
      const paymentResponse = await fetch(paymentUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!paymentResponse.ok) {
        const errorText = await paymentResponse.text();
        throw new Error(
          `Mercado Pago API error (${paymentResponse.status} ${paymentResponse.statusText}): ${errorText}`,
        );
      }

      const paymentData =
        (await paymentResponse.json()) as MercadoPagoMovementsResponse;
      return paymentData;
    }

    const errorText = await movementResponse.text();
    throw new Error(
      `Mercado Pago API error (${movementResponse.status} ${movementResponse.statusText}): ${errorText}`,
    );
  }

  /**
   * Fetch all movements/payments within a date range by handling pagination automatically
   */
  async fetchAllMovements(
    options: {
      beginDate?: string;
      endDate?: string;
      batchSize?: number;
      maxResults?: number;
    } = {},
  ): Promise<MercadoPagoMovement[]> {
    const batchSize = options.batchSize || 50;
    const maxResults = options.maxResults || 500;
    let offset = 0;
    let total = Infinity;
    const allMovements: MercadoPagoMovement[] = [];

    while (offset < total && allMovements.length < maxResults) {
      const result = await this.searchMovements({
        beginDate: options.beginDate,
        endDate: options.endDate,
        limit: batchSize,
        offset,
      });

      const movements = result.results || [];
      if (movements.length === 0) {
        break;
      }

      allMovements.push(...movements);
      total = result.paging?.total ?? movements.length;
      offset += movements.length;

      // Avoid hitting rate limits
      if (offset < total && allMovements.length < maxResults) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return allMovements;
  }
}

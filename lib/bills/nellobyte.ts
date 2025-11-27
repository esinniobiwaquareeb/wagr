import { NellobyteAirtimeResponse } from '@/lib/bills/types';

export interface NellobyteConfig {
  userId: string;
  apiKey: string;
  callbackUrl?: string;
  baseUrl?: string;
}

export interface NellobyteAirtimePayload {
  amount: number;
  phoneNumber: string;
  networkCode: string;
  requestId: string;
  bonusType?: string | null;
}

const DEFAULT_BASE_URL = 'https://www.nellobytesystems.com';

export async function requestNellobyteAirtime(
  config: NellobyteConfig,
  payload: NellobyteAirtimePayload,
): Promise<NellobyteAirtimeResponse> {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const url = new URL('/APIAirtimeV1.asp', baseUrl);

  url.searchParams.set('UserID', config.userId);
  url.searchParams.set('APIKey', config.apiKey);
  url.searchParams.set('MobileNetwork', payload.networkCode);
  url.searchParams.set('Amount', payload.amount.toString());
  url.searchParams.set('MobileNumber', payload.phoneNumber);
  url.searchParams.set('RequestID', payload.requestId);

  if (config.callbackUrl) {
    url.searchParams.set('CallBackURL', config.callbackUrl);
  }

  if (payload.bonusType) {
    url.searchParams.set('BonusType', payload.bonusType);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Nellobyte airtime request failed with status ${response.status}`);
  }

  const data = (await response.json()) as NellobyteAirtimeResponse;
  return data;
}

export async function queryNellobyteOrder(
  config: NellobyteConfig,
  identifier: { orderId?: string; requestId?: string },
): Promise<NellobyteAirtimeResponse> {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const url = new URL('/APIQueryV1.asp', baseUrl);

  url.searchParams.set('UserID', config.userId);
  url.searchParams.set('APIKey', config.apiKey);

  if (identifier.orderId) {
    url.searchParams.set('OrderID', identifier.orderId);
  } else if (identifier.requestId) {
    url.searchParams.set('RequestID', identifier.requestId);
  } else {
    throw new Error('Either orderId or requestId is required to query Nellobyte order');
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Nellobyte query failed with status ${response.status}`);
  }

  const data = (await response.json()) as NellobyteAirtimeResponse;
  return data;
}

export function isNellobyteSuccess(statusCode?: string): boolean {
  if (!statusCode) return false;
  return statusCode === '200';
}

export function isNellobyteProcessing(statusCode?: string): boolean {
  if (!statusCode) return false;
  return statusCode === '100' || statusCode === '101';
}


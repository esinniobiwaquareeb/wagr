import { NellobyteAirtimeResponse, DataPlan } from '@/lib/bills/types';

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

export interface NellobyteDataPayload {
  phoneNumber: string;
  networkCode: string;
  dataPlanCode: string;
  requestId: string;
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

export async function requestNellobyteDataBundle(
  config: NellobyteConfig,
  payload: NellobyteDataPayload,
): Promise<NellobyteAirtimeResponse> {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const url = new URL('/APIDatabundleV1.asp', baseUrl);

  url.searchParams.set('UserID', config.userId);
  url.searchParams.set('APIKey', config.apiKey);
  url.searchParams.set('MobileNetwork', payload.networkCode);
  url.searchParams.set('DataPlan', payload.dataPlanCode);
  url.searchParams.set('MobileNumber', payload.phoneNumber);
  url.searchParams.set('RequestID', payload.requestId);

  if (config.callbackUrl) {
    url.searchParams.set('CallBackURL', config.callbackUrl);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Nellobyte data request failed with status ${response.status}`);
  }

  const data = (await response.json()) as NellobyteAirtimeResponse;
  return data;
}

export interface NellobytePlanResponse {
  MobileNetwork?: string;
  mobilenetwork?: string;
  network?: string;
  Network?: string;
  DataPlan?: string;
  dataplan?: string;
  data_plan?: string;
  Amount?: string | number;
  amount?: string | number;
  Product_Name?: string;
  product_name?: string;
  plan?: string;
  description?: string;
  Remark?: string;
  remark?: string;
  OrderType?: string;
  ordertype?: string;
}

export async function fetchNellobyteDataPlans(config: NellobyteConfig): Promise<NellobytePlanResponse[]> {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const url = new URL('/APIDatabundlePlansV2.asp', baseUrl);
  url.searchParams.set('UserID', config.userId);

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Nellobyte data plans request failed with status ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error('Unexpected data plan format received from Nellobyte');
  }

  return data;
}

export function mapNellobytePlansToDataPlans(
  plans: Array<Record<string, any>>,
  networkCode: string,
  networkName?: string,
): DataPlan[] {
  const resolvedNetworkName = networkName || networkCode;

  return plans
    .filter((plan) => {
      const networkField =
        plan.MobileNetwork ||
        plan.mobilenetwork ||
        plan.network ||
        plan.Network ||
        '';
      if (!networkField) return true; // Some APIs omit network per plan
      return networkField.toLowerCase().includes(resolvedNetworkName.toLowerCase());
    })
    .map((plan) => {
      const code =
        plan.DataPlan || plan.dataplan || plan.data_plan || plan.plan || plan.OrderType || plan.ordertype || '';
      const rawAmount = plan.Amount ?? plan.amount ?? plan.Remark ?? plan.remark;
      const price = typeof rawAmount === 'number' ? rawAmount : parseFloat(String(rawAmount).replace(/[^\d.]/g, '')) || 0;
      const label =
        plan.Product_Name ||
        plan.product_name ||
        plan.OrderType ||
        plan.ordertype ||
        plan.description ||
        plan.Remark ||
        plan.remark ||
        `${code} ${resolvedNetworkName}`;

      return {
        code: code.toString(),
        label,
        price,
        networkCode,
        description: plan.description || plan.Remark || plan.remark,
        raw: plan,
      };
    })
    .filter((plan) => plan.code && plan.price > 0);
}


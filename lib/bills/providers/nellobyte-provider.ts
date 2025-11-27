import { BillsProvider } from '@/lib/bills/providers/types';
import {
  AirtimePurchasePayload,
  AirtimePurchaseResult,
  ProviderCallbackResult,
  DataPlan,
  DataPurchasePayload,
  DataPurchaseResult,
} from '@/lib/bills/types';
import {
  requestNellobyteAirtime,
  isNellobyteProcessing,
  isNellobyteSuccess,
  NellobyteConfig,
  requestNellobyteDataBundle,
} from '@/lib/bills/nellobyte';
import { BillsSettings } from '@/lib/settings';

interface NellobyteProviderOptions {
  settings: BillsSettings;
}

export function createNellobyteProvider(
  options: NellobyteProviderOptions,
): BillsProvider | undefined {
  const { settings } = options;
  const userId = settings.providerConfigs?.nellobyte?.userId;
  const apiKey = settings.providerConfigs?.nellobyte?.apiKey;

  if (!userId || !apiKey) {
    return undefined;
  }

  const config: NellobyteConfig = {
    userId,
    apiKey,
    callbackUrl: settings.callbackUrl,
  };

  return {
    key: 'nellobyte',
    label: 'Nellobyte Systems',
    supports: {
      airtime: true,
      data: true,
    },
    async purchaseAirtime(payload: AirtimePurchasePayload): Promise<AirtimePurchaseResult> {
      const response = await requestNellobyteAirtime(config, {
        amount: payload.amount,
        phoneNumber: payload.phoneNumber,
        networkCode: payload.networkCode,
        requestId: payload.requestId,
        bonusType: payload.bonusType,
      });

      const statusCode = response.statuscode;
      let status: AirtimePurchaseResult['status'] = 'processing';

      if (isNellobyteSuccess(statusCode)) {
        status = 'completed';
      } else if (!isNellobyteProcessing(statusCode)) {
        status = 'failed';
      }

      return {
        status,
        message: response.status || response.remark,
        providerStatus: response.status,
        providerStatusCode: response.statuscode,
        orderId: response.orderid,
        requestId: payload.requestId,
        rawResponse: response,
      };
    },
    async purchaseData(payload: DataPurchasePayload): Promise<DataPurchaseResult> {
      const response = await requestNellobyteDataBundle(config, {
        phoneNumber: payload.phoneNumber,
        networkCode: payload.networkCode,
        dataPlanCode: payload.dataPlanCode,
        requestId: payload.requestId,
      });

      const statusCode = response.statuscode;
      let status: DataPurchaseResult['status'] = 'processing';

      if (isNellobyteSuccess(statusCode)) {
        status = 'completed';
      } else if (!isNellobyteProcessing(statusCode)) {
        status = 'failed';
      }

      return {
        status,
        message: response.status || response.remark,
        providerStatus: response.status,
        providerStatusCode: response.statuscode,
        orderId: response.orderid,
        requestId: payload.requestId,
        rawResponse: response,
      };
    },
    normalizeCallback(params: URLSearchParams | Record<string, string | null | undefined>) {
      const getValue = (key: string) => {
        if (params instanceof URLSearchParams) {
          return params.get(key) || params.get(key.toLowerCase());
        }
        return params[key] ?? params[key.toLowerCase()];
      };

      const statusCode = getValue('StatusCode');
      const statusText = getValue('OrderStatus') || getValue('status');
      const remark = getValue('OrderRemark') || getValue('remark');
      const orderId = getValue('OrderID') || getValue('orderid') || undefined;
      const requestId = getValue('RequestID') || getValue('requestid') || undefined;

      let status: ProviderCallbackResult['status'] = 'processing';
      if (isNellobyteSuccess(statusCode || undefined) || statusText === 'ORDER_COMPLETED') {
        status = 'completed';
      } else if (!isNellobyteProcessing(statusCode || undefined)) {
        status = 'failed';
      }

      const rawEntries =
        params instanceof URLSearchParams
          ? Array.from(params.entries())
          : Object.entries(params as Record<string, string | null | undefined>);

      return {
        status,
        orderId,
        requestId,
        statusCode: statusCode || undefined,
        remark: remark || statusText || undefined,
        rawResponse: Object.fromEntries(rawEntries),
      };
    },
  };
}


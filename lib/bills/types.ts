export type BillPaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

export type BillCategory = 'airtime' | 'data' | 'electricity' | 'cable' | 'other';

export interface AirtimePurchaseRequest {
  phoneNumber: string;
  amount: number;
  networkCode: string;
  networkName?: string;
  bonusType?: string | null;
}

export type ProviderPurchaseStatus = 'processing' | 'completed' | 'failed';

export interface AirtimePurchasePayload extends AirtimePurchaseRequest {
  clientReference: string;
  requestId: string;
}

export interface AirtimePurchaseResult {
  status: ProviderPurchaseStatus;
  message?: string;
  providerStatus?: string;
  providerStatusCode?: string;
  orderId?: string;
  requestId: string;
  rawResponse?: any;
}

export interface ProviderCallbackResult {
  status: ProviderPurchaseStatus;
  orderId?: string;
  requestId?: string;
  statusCode?: string;
  remark?: string;
  rawResponse?: any;
}

export interface NellobyteAirtimeResponse {
  orderid?: string;
  statuscode?: string;
  status?: string;
  remark?: string;
  ordertype?: string;
  mobilenetwork?: string;
  mobilenumber?: string;
  amountcharged?: string;
  walletbalance?: string;
  [key: string]: any;
}


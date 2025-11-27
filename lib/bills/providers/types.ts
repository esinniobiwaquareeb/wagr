import {
  AirtimePurchasePayload,
  AirtimePurchaseResult,
  ProviderCallbackResult,
  BillCategory,
  DataPurchasePayload,
  DataPurchaseResult,
  DataPlan,
} from '@/lib/bills/types';
import { BillsSettings } from '@/lib/settings';

export interface BillsProvider {
  key: string;
  label: string;
  supports: {
    airtime: boolean;
    data: boolean;
    [category: string]: boolean;
  };
  purchaseAirtime(payload: AirtimePurchasePayload): Promise<AirtimePurchaseResult>;
  purchaseData?(payload: DataPurchasePayload): Promise<DataPurchaseResult>;
  fetchDataPlans?(networkCode: string): Promise<DataPlan[]>;
  normalizeCallback(
    params: URLSearchParams | Record<string, string | null | undefined>,
  ): ProviderCallbackResult;
}

export type BillsProviderFactory = (options: {
  settings: BillsSettings;
}) => BillsProvider | undefined;

export interface ProviderRegistryEntry {
  key: string;
  factory: BillsProviderFactory;
  supportedCategories: BillCategory[];
}


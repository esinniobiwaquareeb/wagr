import {
  AirtimePurchasePayload,
  AirtimePurchaseResult,
  ProviderCallbackResult,
  BillCategory,
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


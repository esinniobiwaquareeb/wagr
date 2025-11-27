import type { DataPlan } from '@/lib/bills/types';

export interface RawPlanProduct {
  PRODUCT_ID?: string;
  PRODUCT_CODE?: string;
  PRODUCT_NAME?: string;
  PRODUCT_AMOUNT?: string | number;
  description?: string;
  plan?: string;
  OrderType?: string;
  ordertype?: string;
  [key: string]: any;
}

export interface RawPlanEntry {
  ID?: string;
  PRODUCT?: RawPlanProduct[];
}

export interface RawPlanCatalog {
  MOBILE_NETWORK?: Record<string, RawPlanEntry[]>;
}

export function parsePlanPrice(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const numeric = parseFloat(value.replace(/[^\d.]/g, ''));
    return Number.isFinite(numeric) ? numeric : 0;
  }
  return 0;
}

export function buildPlanCatalog(
  rawCatalog: RawPlanCatalog | null | undefined,
): Record<string, DataPlan[]> {
  const catalog: Record<string, DataPlan[]> = {};
  if (!rawCatalog?.MOBILE_NETWORK) {
    return catalog;
  }

  Object.entries(rawCatalog.MOBILE_NETWORK).forEach(([networkName, entries]) => {
    if (!Array.isArray(entries)) {
      return;
    }

    entries.forEach((entry) => {
      const networkCode = entry?.ID || networkName;
      if (!networkCode || !Array.isArray(entry?.PRODUCT)) {
        return;
      }

      const mappedPlans = entry.PRODUCT.map((product) => {
        const code =
          product?.PRODUCT_ID ||
          product?.PRODUCT_CODE ||
          product?.plan ||
          product?.OrderType ||
          product?.ordertype;
        if (!code) {
          return null;
        }

        const price = parsePlanPrice(product?.PRODUCT_AMOUNT);
        if (price <= 0) {
          return null;
        }

        const label =
          product?.PRODUCT_NAME ||
          product?.description ||
          `${networkName} plan (${code})`;

        return {
          code: code.toString(),
          label,
          price,
          networkCode,
          description: product?.PRODUCT_NAME || product?.description || '',
          raw: product,
        } as DataPlan;
      }).filter((plan): plan is DataPlan => Boolean(plan?.code && plan?.price));

      if (!catalog[networkCode]) {
        catalog[networkCode] = [];
      }
      catalog[networkCode] = [...catalog[networkCode], ...mappedPlans].sort(
        (a, b) => a.price - b.price,
      );
    });
  });

  return catalog;
}

export function findPlanInCatalog(
  catalog: Record<string, DataPlan[]>,
  networkCode: string,
  planCode?: string,
): DataPlan | undefined {
  if (!planCode) {
    return undefined;
  }
  const plans = catalog[networkCode] || [];
  return plans.find((plan) => plan.code === planCode);
}


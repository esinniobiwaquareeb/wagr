import { createServiceRoleClient } from '@/lib/supabase/server';
import { getBillsSettings } from '@/lib/settings';
import { mapNellobytePlansToDataPlans } from '@/lib/bills/nellobyte';

interface NellobyteCatalog {
  MOBILE_NETWORK?: Record<
    string,
    Array<{
      ID?: string;
      PRODUCT?: Array<Record<string, any>>;
    }>
  >;
}

export async function fetchNellobytePlanCatalog(): Promise<Array<{
  networkCode: string;
  networkName: string;
  plans: ReturnType<typeof mapNellobytePlansToDataPlans>;
}>> {
  const settings = await getBillsSettings();
  const nellobyteConfig = settings.providerConfigs?.nellobyte;
  if (!nellobyteConfig?.userId) {
    throw new Error('Nellobyte user ID not configured');
  }

  const url = `https://www.nellobytesystems.com/APIDatabundlePlansV2.asp?UserID=${encodeURIComponent(
    nellobyteConfig.userId,
  )}`;
  const response = await fetch(url, { method: 'GET', cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to fetch data plans: ${response.status}`);
  }

  const catalog = (await response.json()) as NellobyteCatalog;
  const mobileNetworks = catalog.MOBILE_NETWORK || {};
  const results: Array<{
    networkCode: string;
    networkName: string;
    plans: ReturnType<typeof mapNellobytePlansToDataPlans>;
  }> = [];

  for (const [networkName, entries] of Object.entries(mobileNetworks)) {
    entries.forEach((entry) => {
      const code = entry.ID || networkName;
      const plans = mapNellobytePlansToDataPlans(entry.PRODUCT || [], code, networkName);
      results.push({
        networkCode: code,
        networkName,
        plans,
      });
    });
  }

  return results;
}

export async function syncNellobyteDataPlans(): Promise<number> {
  const catalog = await fetchNellobytePlanCatalog();
  const supabase = createServiceRoleClient();

  const rows = catalog.flatMap(({ networkCode, networkName, plans }) =>
    plans.map((plan) => ({
      network_code: networkCode,
      network_name: networkName,
      plan_code: plan.code,
      plan_label: plan.label,
      plan_price: plan.price,
      plan_description: plan.description || null,
      raw_data: plan.raw || null,
      is_active: true,
    })),
  );

  if (!rows.length) {
    return 0;
  }

  const { error } = await supabase
    .from('data_plans')
    .upsert(rows, { onConflict: 'network_code, plan_code' });

  if (error) {
    throw new Error(`Failed to store data plans: ${error.message}`);
  }

  return rows.length;
}

export async function getStoredDataPlans(networkCode: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from('data_plans')
    .select('*')
    .eq('network_code', networkCode)
    .eq('is_active', true)
    .order('plan_price', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch stored data plans: ${error.message}`);
  }

  return data || [];
}


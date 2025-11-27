import { BillsSettings } from '@/lib/settings';
import { BillsProvider, ProviderRegistryEntry } from '@/lib/bills/providers/types';
import { createNellobyteProvider } from '@/lib/bills/providers/nellobyte-provider';

const providerRegistry: ProviderRegistryEntry[] = [
  {
    key: 'nellobyte',
    factory: createNellobyteProvider,
    supportedCategories: ['airtime'],
  },
];

export function getBillsProvider(
  key: string,
  settings: BillsSettings,
): BillsProvider | undefined {
  const entry = providerRegistry.find((provider) => provider.key === key);
  if (!entry) {
    return undefined;
  }

  return entry.factory({ settings });
}

export function listAvailableProviders(settings: BillsSettings): BillsProvider[] {
  return providerRegistry
    .filter((entry) => settings.enabledProviders.includes(entry.key))
    .map((entry) => entry.factory({ settings }))
    .filter((provider): provider is BillsProvider => Boolean(provider));
}


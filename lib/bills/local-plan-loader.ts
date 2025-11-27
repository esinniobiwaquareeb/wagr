import path from 'path';
import { promises as fs } from 'fs';
import type { DataPlan } from '@/lib/bills/types';
import {
  buildPlanCatalog,
  RawPlanCatalog,
  findPlanInCatalog,
} from '@/lib/bills/data-plan-utils';

let cachedCatalog: Record<string, DataPlan[]> | null = null;
let lastLoadedAt: number | null = null;

async function loadCatalogFromDisk(): Promise<Record<string, DataPlan[]>> {
  const filePath = path.join(process.cwd(), 'public', 'nellobyte_data_plans.json');
  const fileContents = await fs.readFile(filePath, 'utf-8');
  const rawCatalog = JSON.parse(fileContents) as RawPlanCatalog;
  cachedCatalog = buildPlanCatalog(rawCatalog);
  lastLoadedAt = Date.now();
  return cachedCatalog;
}

export async function getLocalPlanCatalog(forceReload = false) {
  if (!cachedCatalog || forceReload) {
    await loadCatalogFromDisk();
  }
  return cachedCatalog!;
}

export async function getPlanFromLocalCatalog(networkCode: string, planCode?: string) {
  const catalog = await getLocalPlanCatalog();
  return findPlanInCatalog(catalog, networkCode, planCode);
}

export function clearPlanCatalogCache() {
  cachedCatalog = null;
  lastLoadedAt = null;
}


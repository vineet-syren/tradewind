/**
 * Source registry + selector. Selects a data source by VITE_DASHBOARD_DATA_SOURCE
 * and falls back to mock on an unknown/invalid key, so a bad env value can never
 * crash the app. The chosen source is logged once for demo visibility.
 */
import type { CarbonDataSource } from '@/services/dataSource';
import { MockDataSource } from '@/services/adapters/data-sources/mockDataSource';
import { ApiDataSource } from '@/services/adapters/data-sources/apiDataSource';

export type DataSourceKey = 'mock' | 'api';

const FACTORIES: Record<DataSourceKey, () => CarbonDataSource> = {
  mock: () => new MockDataSource(),
  api: () => new ApiDataSource(import.meta.env.VITE_API_BASE_URL ?? '/api'),
};

function resolveDataSource(): CarbonDataSource {
  const requested = (import.meta.env.VITE_DASHBOARD_DATA_SOURCE ?? 'mock').toLowerCase();
  const isKnown = requested in FACTORIES;
  try {
    const source = FACTORIES[(isKnown ? requested : 'mock') as DataSourceKey]();
    if (!isKnown)
      console.warn(`[dataSource] Unknown VITE_DASHBOARD_DATA_SOURCE="${requested}" — falling back to "mock".`);
    console.info(`[dataSource] Active source: "${source.id}" — ${source.label}`);
    return source;
  } catch (err) {
    console.error(`[dataSource] Failed to init "${requested}", falling back to mock.`, err);
    return FACTORIES.mock();
  }
}

export const dataSource: CarbonDataSource = resolveDataSource();

import { dataSource } from '@/services/dataSourceRegistry';
import type { CarbonDataSource } from '@/services/dataSource';

/**
 * Returns the active data source. Components depend on this hook, not on a
 * concrete implementation, so swapping mock ↔ api stays a registry concern.
 */
export function useDataSource(): CarbonDataSource {
  return dataSource;
}

/** Static catalogue of the decisioning agents surfaced in the UI. */
export interface AgentCatalogEntry {
  id: string;
  name: string;
  role: string;
  description: string;
  autonomy: 'auto' | 'assisted';
  iconKey: string;
}

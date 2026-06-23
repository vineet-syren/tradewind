import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/tables/DataTable';
import { TableSkeleton } from '@/components/loaders/Skeletons';
import { NavIcon } from '@/components/layout/iconRegistry';
import { alpha } from '@mui/material/styles';
import { useDataSource } from '@/hooks/useDataSource';
import { useAsync } from '@/hooks/useAsync';
import { AGENT_CATALOG } from '@/constants/agents';
import type { EmissionFactorRow } from '@/types';

export default function MethodologyPage() {
  const ds = useDataSource();
  const { data: factors, status } = useAsync(() => ds.getEmissionFactors(), []);

  const columns: Column<EmissionFactorRow>[] = [
    { key: 'mode', header: 'Mode', render: (r) => <Chip size="small" label={r.mode} variant="outlined" />, sortValue: (r) => r.mode },
    { key: 'basis', header: 'Basis', render: (r) => <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.basis}</Typography> },
    { key: 'value', header: 'Factor', align: 'right', render: (r) => <strong>{r.value}</strong>, sortValue: (r) => r.value },
    { key: 'unit', header: 'Unit', render: (r) => <Typography variant="caption" color="text.secondary">{r.unit}</Typography> },
    { key: 'source', header: 'Source', render: (r) => r.source },
    { key: 'note', header: 'Note', render: (r) => <Typography variant="caption" color="text.secondary">{r.note}</Typography> },
  ];

  return (
    <Box>
      <PageHeader
        overline="Reference"
        title="Methodology & Emission Factors"
        subtitle="The distance-based calculation behind every number in Tradewind — transparent, auditable and aligned with the customer's GHG approach."
      />

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Core formula
          </Typography>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover', mb: 2 }}>
            <Typography sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: { xs: 13, md: 16 } }}>
              CO₂e (kg) = Weight (tonnes) × Distance (km) × Emission Factor (kg CO₂e / tonne-km)
            </Typography>
          </Box>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
            <Concept title="Weight" text="The chargeable weight of goods on each leg. For shared/consolidated containers, CO₂e is attributed by the shipment's weight share." />
            <Concept title="Distance" text="Straight-line Haversine distance between validated source/destination coordinates, plus a 20% buffer for indirect routes and deviations." />
            <Concept title="Emission factor" text="Mode- and distance-tiered. Air uses the client's distance tiers; ocean, rail and road use global container/rail/full-truck factors so modes compare on CO₂e per tonne-km." />
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
            Emission factors
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Held constant within the reporting window · region-specific factors to be confirmed with the customer
          </Typography>
          <Box sx={{ mt: 1.5 }}>
            {status === 'loading' || !factors ? <TableSkeleton rows={8} /> : <DataTable columns={columns} rows={factors} getRowKey={(r) => r.id} initialSortKey="mode" />}
          </Box>
        </CardContent>
      </Card>

      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
        Decisioning agents
      </Typography>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' } }}>
        {AGENT_CATALOG.map((a) => (
          <Card key={a.id}>
            <CardContent>
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: (t) => alpha(t.palette.primary.main, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <NavIcon iconKey={a.iconKey} color="primary" />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                    {a.name}
                  </Typography>
                  <Chip size="small" label={a.autonomy === 'auto' ? 'Autonomous' : 'Assisted'} variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                </Box>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {a.description}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
}

function Concept({ title, text }: { title: string; text: string }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {text}
      </Typography>
    </Box>
  );
}

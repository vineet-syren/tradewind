import { Alert, AlertTitle, Button } from '@mui/material';

export function ErrorState({ error, onRetry }: { error?: Error; onRetry?: () => void }) {
  return (
    <Alert
      severity="error"
      action={onRetry ? <Button color="inherit" size="small" onClick={onRetry}>Retry</Button> : undefined}
    >
      <AlertTitle>Couldn’t load this view</AlertTitle>
      {error?.message ?? 'An unexpected error occurred while loading data.'}
    </Alert>
  );
}

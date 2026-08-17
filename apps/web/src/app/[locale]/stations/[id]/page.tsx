import { Suspense } from 'react';
import { StationDetailView } from '@/components/stations/StationDetailView';

export default async function StationPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense fallback={null}>
      <StationDetailView stationId={id} />
    </Suspense>
  );
}

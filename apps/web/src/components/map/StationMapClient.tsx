'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

const StationMapImpl = dynamic(
  () =>
    import('@/components/map/StationMap').then((mod) => mod.StationMap),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          width: '100%',
          height: '100%',
          minHeight: '18rem',
          borderRadius: '1rem',
          border: '1px solid var(--border)',
          background: 'var(--surface-muted)',
        }}
      />
    ),
  },
);

export function StationMap(props: ComponentProps<typeof StationMapImpl>) {
  return <StationMapImpl {...props} />;
}

import { Suspense } from 'react';
import { HomeExplorer } from '@/components/home/HomeExplorer';

export default function LocaleHomePage() {
  return (
    <Suspense fallback={null}>
      <HomeExplorer />
    </Suspense>
  );
}

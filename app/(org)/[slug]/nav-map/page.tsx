"use client";

import dynamicImport from 'next/dynamic';
import { Suspense } from 'react';
import { LoaderIcon } from 'lucide-react';

const DynamicNavMap = dynamicImport(() => import('./nav-map-client'), {
  loading: () => (
    <div className="flex items-center justify-center h-96">
      <div className="flex items-center gap-2">
        <LoaderIcon className="h-5 w-5 animate-spin" />
        <span>Loading map...</span>
      </div>
    </div>
  ),
  ssr: false
});

export default function NavMapPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center gap-2">
          <LoaderIcon className="h-5 w-5 animate-spin" />
          <span>Initialising map...</span>
        </div>
      </div>
    }>
      <DynamicNavMap />
    </Suspense>
  );
}

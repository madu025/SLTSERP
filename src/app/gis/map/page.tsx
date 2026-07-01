import dynamic from 'next/dynamic';

// Disable Server-Side Rendering (SSR) for Leaflet Map to prevent window is not defined errors
const NationalInfraMap = dynamic(
  () => import('@/components/gis/NationalInfraMap'),
  { ssr: false }
);

export const metadata = {
  title: 'National Infrastructure GIS Map - SLTS ERP',
  description: 'Sri Lanka interactive telecommunication cable routing and pole map overlay dashboard.',
};

export default function NationalMapPage() {
  return (
    <div className="min-h-screen bg-slate-900">
      <NationalInfraMap />
    </div>
  );
}

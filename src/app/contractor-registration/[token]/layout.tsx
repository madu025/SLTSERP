import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contractor Digital Registration | SLTS ERP',
  description: 'Complete your SLT Digital Registration securely. Enter your details and upload required documents to join our contractor network.',
  openGraph: {
    title: 'SLT Contractor Onboarding',
    description: 'Secure digital registration portal for SLT contractors.',
    images: [
      {
        url: '/logo5.png',
        width: 800,
        height: 600,
        alt: 'SLTS ERP Logo',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SLT Contractor Onboarding',
    description: 'Secure digital registration portal for SLT contractors.',
    images: ['/logo5.png'],
  },
};

export default function RegistrationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

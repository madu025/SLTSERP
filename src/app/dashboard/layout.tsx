import type { ReactNode } from 'react';
import { Barlow, Barlow_Semi_Condensed } from 'next/font/google';
import './dashboard.css';

// Same faces as the sign-in page: Barlow for text, Barlow Semi Condensed for headings and figures.
const bodyFont = Barlow({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-dash-body', display: 'swap' });
const displayFont = Barlow_Semi_Condensed({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-dash-display', display: 'swap' });

export default function DashboardLayout({ children }: { children: ReactNode }) {
    return <div className={`${bodyFont.variable} ${displayFont.variable}`}>{children}</div>;
}

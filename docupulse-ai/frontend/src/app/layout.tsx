import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'DocuPulse AI',
  description: 'Grounded research workspace with cited answers, study artifacts and audio overviews.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100">{children}</body>
    </html>
  );
}

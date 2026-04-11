import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ZX Spectrum Flight Simulator',
  description: 'Play the original 1982 Psion Flight Simulation designed for ZX Spectrum 48k',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

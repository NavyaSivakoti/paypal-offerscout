import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'OfferScout — Your AI guide to cashback offers', description: 'Compare shopping offers with transparent terms and estimated savings.' };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body>{children}</body></html>; }

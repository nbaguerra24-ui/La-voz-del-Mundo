import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'La Voz del Mundo',
  description: 'Una humanidad. Millones de opiniones. Una sola voz.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}

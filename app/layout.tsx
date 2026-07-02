import type { Metadata } from 'next';
import './styles.css';

export const metadata: Metadata = {
  title: 'Vhost Manager',
  description: 'Realtime Nginx and PHP-FPM vhost manager',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

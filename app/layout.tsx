import type { Metadata } from 'next';
import { Noto_Sans_Thai } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const notoSansThai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-noto-sans-thai',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Mino — ถอดเสียงและสรุปการประชุม',
  description:
    'Mino แอปถอดเสียงภาษาไทยและสรุปการประชุมด้วย AI พัฒนาโดย Typhoon AI — Meeting Notes · Thai-first',
  keywords: ['transcription', 'meeting', 'summary', 'thai', 'ai', 'typhoon'],
  openGraph: {
    title: 'Mino — ถอดเสียงและสรุปการประชุม',
    description: 'ถอดเสียงภาษาไทยและสรุปการประชุมด้วย AI',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" className={notoSansThai.variable}>
      <body className="font-sans bg-surface text-text min-h-screen">
        {children}
        <Toaster
          position="top-right"
          richColors
          toastOptions={{
            style: {
              fontFamily: 'var(--font-noto-sans-thai), sans-serif',
            },
          }}
        />
      </body>
    </html>
  );
}

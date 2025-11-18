import './globals.css';
import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import { DatabaseProvider } from '@/lib/db-context';
import { CallProvider } from '@/lib/call-context';
import { MediaViewerProvider } from '@/lib/media-viewer-context';
import { ProfileCacheProvider } from '@/lib/profile-cache-context';
import { RecaptchaProvider } from '@/lib/recaptcha-provider';
import { LoadingProvider } from '@/lib/loading-context';
import { Navigation } from '@/components/navigation';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from 'sonner';
import { PageTransition } from '@/components/page-transition';
import { ConnectionStatus } from '@/components/connection-status';
import { IncomingCallNotification } from '@/components/incoming-call-notification';
import { OutgoingCallDialog } from '@/components/outgoing-call-dialog';
import { MediaViewer } from '@/components/media-viewer';
import { ErrorBoundary } from '@/components/error-boundary';
import { GlobalLoadingSpinner } from '@/components/global-loading-spinner';


export const metadata: Metadata = {
  title: 'ReseautageClub - Connect, Share, Build',
  description: 'Join a community of founders, innovators, and dreamers building the future.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#f59e0b',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="overflow-x-hidden">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('error', function(event) {
                if (event.message && (event.message.includes('Loading chunk') || event.message.includes('ChunkLoadError'))) {
                  console.log('ChunkLoadError detected, reloading page...');
                  window.location.reload();
                }
              });

              // Environment verification on startup
              (function() {
                const url = '${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}';
                const key = '${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}';

                console.group('🔧 ReseautageClub - Environment Check');
                console.log('Environment:', '${process.env.NODE_ENV || 'unknown'}');
                console.log('Supabase URL:', url || 'MISSING');
                console.log('Anon Key:', key ? 'Present (' + key.length + ' chars)' : 'MISSING');
                console.log('Origin:', window.location.origin);
                console.log('Timestamp:', new Date().toISOString());

                if (!url || !key) {
                  console.error('❌ CRITICAL: Missing environment variables!');
                } else {
                  console.log('✅ Environment variables loaded');
                }
                console.groupEnd();
              })();
            `,
          }}
        />
      </head>
      <body className="overflow-x-hidden" suppressHydrationWarning>
        <ErrorBoundary>
          <LoadingProvider>
            <RecaptchaProvider>
              <AuthProvider>
                <DatabaseProvider>
                  <ProfileCacheProvider>
                    <CallProvider>
                      <MediaViewerProvider>
                        <Navigation />
                        <PageTransition>
                          <main className="overflow-x-hidden">
                            {children}
                          </main>
                        </PageTransition>
                        <Toaster />
                        <Sonner />
                        <ConnectionStatus />
                        <IncomingCallNotification />
                        <OutgoingCallDialog />
                        <MediaViewer />
                        <GlobalLoadingSpinner />
                      </MediaViewerProvider>
                    </CallProvider>
                  </ProfileCacheProvider>
                </DatabaseProvider>
              </AuthProvider>
            </RecaptchaProvider>
          </LoadingProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}

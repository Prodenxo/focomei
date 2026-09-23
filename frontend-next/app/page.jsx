'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LandingPage } from '@/components/landing/LandingPage';
import { LoadingPanel } from '@/components/ui/LoadingPanel';
import { useAuth } from '@/context/AuthProvider';
import { APP_HOME_HREF } from '@/lib/appRoutes';

export default function PublicHomePage() {
  const router = useRouter();
  const { booting, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!booting && isAuthenticated) router.replace(APP_HOME_HREF);
  }, [booting, isAuthenticated, router]);

  if (booting || isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d2b5e] text-white">
        <LoadingPanel label={booting ? 'Carregando…' : 'Abrindo sua visão geral…'} />
      </div>
    );
  }

  return <LandingPage />;
}

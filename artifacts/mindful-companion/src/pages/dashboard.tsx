import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { LanguageToggle } from '@/pages/landing';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Home, LayoutGrid, Wind, Layers, LogOut, Sparkles, CalendarCheck, ArrowLeft, ArrowRight } from 'lucide-react';
import { dailyCopy } from '@/lib/daily-copy';
import { GentleLoader } from '@/components/gentle-loader';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const { t, lang } = useI18n();
  const dc = dailyCopy[lang];
  const [, setLocation] = useLocation();
  const { loading, signOut, user } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    setSignOutError(false);

    try {
      await signOut();
      setLocation('/sign-in');
    } catch {
      setSignOutError(true);
      setIsSigningOut(false);
    }
  }

  // Redirect to sign-in if not logged in and not loading.
  useEffect(() => {
    if (!loading && !user) {
      setLocation('/sign-in');
    }
  }, [loading, user, setLocation]);

  if (loading || !user) {
    return <GentleLoader />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-white/80 px-4 py-4 backdrop-blur-md sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary font-medium text-primary-foreground shadow-sm">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-medium text-foreground">{user.name}</h1>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">{user.email}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Button
            asChild
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full px-3 text-foreground/80"
          >
            <Link href="/">
              <Home aria-hidden="true" />
              <span className="hidden sm:inline">{t('backHome')}</span>
              <span className="sr-only sm:hidden">{t('backHome')}</span>
            </Link>
          </Button>
          <Button asChild type="button" variant="ghost" size="sm" className="rounded-full px-3 text-foreground/80">
            <Link href="/uf30/afta" data-testid="link-dashboard-afta-hub">
              <LayoutGrid aria-hidden="true" />
              <span className="hidden sm:inline">{lang === 'ar' ? 'مركز أفتا' : 'AFTA hub'}</span>
              <span className="sr-only sm:hidden">{lang === 'ar' ? 'مركز أفتا' : 'AFTA hub'}</span>
            </Link>
          </Button>
          <LanguageToggle />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            disabled={isSigningOut}
            aria-busy={isSigningOut}
            data-testid="button-sign-out"
            className="rounded-full border-border bg-white/70 px-3 text-foreground/80"
          >
            <LogOut aria-hidden="true" />
            <span className="hidden sm:inline">{t('signOut')}</span>
            <span className="sr-only sm:hidden">{t('signOut')}</span>
          </Button>
        </div>
      </header>
      {signOutError && (
        <p
          role="alert"
          className="border-b border-red-100 bg-red-50 px-4 py-2 text-center text-sm text-red-700"
          data-testid="status-sign-out-error"
        >
          {t('signOutError')}
        </p>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-light tracking-tight text-foreground">
            {t('dashboardWelcome')}، {user.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('dashboardSubtitle')}
          </p>
        </div>

        <Link href="/daily" className="group flex flex-col gap-4 rounded-3xl bg-primary p-6 text-primary-foreground shadow-md transition hover:shadow-lg sm:flex-row sm:items-center sm:justify-between sm:p-7" data-testid="link-dashboard-daily">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-foreground/15"><CalendarCheck className="h-5 w-5" /></div>
            <div>
              <h3 className="text-lg font-medium">{dc.dashboardCardTitle}</h3>
              <p className="mt-1 text-sm opacity-80">{dc.dashboardCardBody}</p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary-foreground px-4 py-2 text-sm text-primary">{dc.open}{lang === 'ar' ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}</span>
        </Link>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/declutter">
            <div className="group p-6 rounded-2xl bg-white border border-card-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer flex flex-col justify-between h-full">
              <div className="w-10 h-10 rounded-xl bg-secondary text-primary flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Wind className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-medium text-foreground mb-1">{t('cardDeclutter')}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{t('cardDeclutterDescription')}</p>
              </div>
            </div>
          </Link>

          <Link href="/organize-thoughts">
            <div className="group p-6 rounded-2xl bg-white border border-card-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer flex flex-col justify-between h-full">
              <div className="w-10 h-10 rounded-xl bg-secondary text-primary flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-medium text-foreground mb-1">{t('cardOrganize')}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{t('cardOrganizeDescription')}</p>
              </div>
            </div>
          </Link>

          <Link href="/daily-questions">
            <div className="group p-6 rounded-2xl bg-white border border-card-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer flex flex-col justify-between h-full">
              <div className="w-10 h-10 rounded-xl bg-secondary text-primary flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-medium text-foreground mb-1">{t('dailyQuestionsTitle')}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{t('dailyQuestionsDescription')}</p>
              </div>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}

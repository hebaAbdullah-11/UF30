import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';
import { LanguageToggle } from '@/pages/landing';
import { useI18n } from '@/lib/i18n';

export default function NotFound() {
  const { t, lang } = useI18n();
  return (
    <main className="grain flex min-h-[100dvh] items-center justify-center bg-background px-5">
      <div className="w-full max-w-lg text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-secondary text-2xl font-bold text-primary">404</div>
        <h1 className="mt-8 font-arabic text-4xl font-bold tracking-[-.07em] text-primary">{t('notFoundTitle')}</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-8 text-muted-foreground">{t('notFoundBody')}</p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <LanguageToggle />
          <Link href="/" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-not-found-home">
            {lang === 'ar' ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />} {t('backHome')}
          </Link>
        </div>
      </div>
    </main>
  );
}
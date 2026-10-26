import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, ArrowRight, Home } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { LanguageToggle } from '@/pages/landing';

export function SectionHeader({
  title,
  backTo = '/dashboard',
  colorClass = 'text-primary',
  belowLanguage,
}: {
  title: string;
  backTo?: string;
  colorClass?: string;
  belowLanguage?: ReactNode;
}) {
  const { lang, t } = useI18n();
  const isRtl = lang === 'ar';
  const Arrow = isRtl ? ArrowRight : ArrowLeft;

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between bg-background/80 px-5 py-4 backdrop-blur-md sm:px-8">
      <nav className="flex items-center gap-1" aria-label={t('backHome')}>
        <Link href={backTo} className="group flex items-center gap-2 rounded-lg px-2 py-1 -ml-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rtl:-mr-2 rtl:-ml-0" data-testid="button-back">
          <Arrow className="h-4 w-4 transition-transform group-hover:-translate-x-1 rtl:group-hover:translate-x-1" />
          <span className="hidden font-arabic sm:inline">{t('back')}</span>
        </Link>
        <Link href="/" className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="button-home">
          <Home className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">{t('backHome')}</span>
        </Link>
      </nav>
      <div className={`absolute left-1/2 -translate-x-1/2 font-arabic text-lg font-bold ${colorClass}`}>
        {title}
      </div>
      <div className="flex flex-col items-end gap-2">
        <LanguageToggle />
        {belowLanguage}
      </div>
    </header>
  );
}

import { ArrowLeft, ArrowUpLeft, Check, ChevronDown, Circle, Sparkles } from 'lucide-react';
import { Link } from 'wouter';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';

function Brand() {
  const { t } = useI18n();
  return (
    <Link href="/" className="group flex items-center gap-3" data-testid="link-brand">
      <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-primary text-primary-foreground shadow-sm transition-transform duration-300 group-hover:-rotate-6">
        <span className="block h-3 w-3 rounded-full border-2 border-current" />
      </span>
      <span className="leading-none">
        <span className="block font-arabic text-[1.1rem] font-bold tracking-[-.04em]">{t('brand')}</span>
        <span className="mt-1 block text-[.58rem] font-semibold uppercase tracking-[.17em] text-muted-foreground">{t('brandTag')}</span>
      </span>
    </Link>
  );
}

export function LanguageToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
      className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3.5 py-2 text-xs font-semibold text-foreground shadow-xs backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-testid="button-language-toggle"
      aria-label={lang === 'ar' ? t('languageEnglish') : t('languageArabic')}
    >
      <span className="font-mono-ui text-[.66rem] uppercase tracking-[.18em] text-muted-foreground">{lang === 'ar' ? 'EN' : 'ع'}</span>
      <span>{lang === 'ar' ? t('languageEnglish') : t('languageArabic')}</span>
    </button>
  );
}

function RhythmCard() {
  const { t } = useI18n();
  return (
    <div className="float-gently relative mx-auto w-full max-w-[480px]">
      <div className="absolute -left-4 top-16 hidden h-20 w-20 rounded-full border border-accent/40 sm:block" />
      <div className="absolute -right-5 bottom-8 hidden h-12 w-12 rounded-full bg-accent/30 sm:block" />
      <div className="relative overflow-hidden rounded-[2rem] border border-primary/10 bg-secondary/70 p-4 shadow-lg sm:p-6">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-accent/40 blur-2xl" />
        <div className="relative rounded-[1.5rem] bg-card/85 p-5 backdrop-blur sm:p-7">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono-ui text-[.62rem] uppercase tracking-[.2em] text-muted-foreground">{t('rhythmLabel')}</p>
              <h3 className="mt-2 font-arabic text-xl font-bold tracking-[-.05em]">{t('rhythmTitle')}</h3>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/35 text-primary">
              <Sparkles className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-8 flex h-28 items-end gap-2" aria-label={t('rhythmTitle')}>
            {[38, 62, 44, 82, 56, 72, 48, 90, 68, 52, 76, 60].map((height, index) => (
              <span key={index} className="flex-1 rounded-t-full bg-primary/75 transition-all duration-500 hover:bg-accent" style={{ height: `${height}%`, opacity: .48 + index / 28 }} />
            ))}
          </div>
          <div className="mt-4 flex justify-between text-[.66rem] font-medium text-muted-foreground">
            <span>{t('rhythmOne')}</span><span>{t('rhythmTwo')}</span><span>{t('rhythmThree')}</span>
          </div>
          <div className="mt-6 flex items-center gap-3 rounded-2xl bg-primary px-4 py-3 text-primary-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground"><Check className="h-3.5 w-3.5" /></span>
            <span className="text-xs font-semibold">{t('rhythmCaption')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { t, lang } = useI18n();
  const { loading, user } = useAuth();
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowUpLeft;
  const primaryHref = user ? '/dashboard' : '/sign-up';
  const primaryLabel = user ? t('dashboardNav') : t('heroPrimary');
  return (
    <main className="grain min-h-[100dvh]">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12" data-testid="navigation-main">
        <Brand />
        <div className="flex items-center gap-2 sm:gap-5">
          <a href="#how-it-helps" className="hidden text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground sm:block" data-testid="link-how-it-helps">{t('navHow')}</a>
          {!loading && (
            <Link href={user ? '/dashboard' : '/sign-in'} className="hidden text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground sm:block" data-testid="link-sign-in-nav">
              {user ? t('dashboardNav') : t('signIn')}
            </Link>
          )}
          <LanguageToggle />
        </div>
      </nav>

      <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-10 sm:px-8 sm:pb-28 sm:pt-16 lg:grid-cols-[1.05fr_.95fr] lg:gap-20 lg:px-12 lg:pt-24">
        <div className="soft-reveal max-w-2xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3.5 py-2 text-xs font-bold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {t('heroKicker')}
          </div>
          <h1 className="max-w-[700px] whitespace-pre-line font-arabic text-[clamp(2.65rem,7vw,6.1rem)] font-bold leading-[1.13] tracking-[-.075em] text-primary">{t('heroTitle')}</h1>
          <p className="mt-7 max-w-xl text-base leading-8 text-muted-foreground sm:text-lg sm:leading-9">{t('heroBody')}</p>
          <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Link href={primaryHref} className="group inline-flex items-center justify-center gap-3 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground shadow-md transition-all duration-300 hover:-translate-y-1 hover:bg-primary/90 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" data-testid="link-create-account-hero">
              {primaryLabel} <Arrow className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            </Link>
            <a href="#how-it-helps" className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-bold text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-learn-more">
              {t('heroSecondary')} <ChevronDown className="h-4 w-4" />
            </a>
          </div>
          <p className="mt-5 text-xs font-medium text-muted-foreground"><Circle className="me-2 inline h-2 w-2 fill-accent text-accent" />{t('heroNote')}</p>
        </div>
        <div className="soft-reveal-delay lg:pt-4"><RhythmCard /></div>
      </section>

      <section id="how-it-helps" className="scroll-mt-10 border-y border-border/70 bg-card/40">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[.8fr_1.2fr] lg:gap-20 lg:px-12">
          <div>
            <p className="font-mono-ui text-xs font-medium uppercase tracking-[.2em] text-accent-foreground/70">{t('sectionKicker')}</p>
            <h2 className="mt-5 whitespace-pre-line font-arabic text-3xl font-bold leading-[1.3] tracking-[-.06em] text-primary sm:text-5xl">{t('sectionTitle')}</h2>
            <p className="mt-6 max-w-md text-sm leading-8 text-muted-foreground sm:text-base">{t('sectionBody')}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['01', 'stepOne', 'stepOneBody'],
              ['02', 'stepTwo', 'stepTwoBody'],
              ['03', 'stepThree', 'stepThreeBody'],
            ].map(([number, title, body], index) => (
              <article key={number} className={`group relative flex min-h-[230px] flex-col justify-between rounded-[1.6rem] border border-border bg-background/60 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-sm ${index === 1 ? 'sm:mt-8' : ''}`} data-testid={`card-step-${number}`}>
                <span className="font-mono-ui text-xs text-muted-foreground">{number}</span>
                <div><h3 className="font-arabic text-xl font-bold text-primary">{t(title)}</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">{t(body)}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="why" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div><p className="font-mono-ui text-xs uppercase tracking-[.2em] text-accent-foreground/70">{t('factsKicker')}</p><h2 className="mt-4 font-arabic text-3xl font-bold tracking-[-.06em] text-primary sm:text-5xl">{t('factsTitle')}</h2></div>
          <p className="max-w-sm text-sm leading-7 text-muted-foreground">{t('factsBody')}</p>
        </div>
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
             ['01', 'factOneTitle', 'factOneBody', 'bg-secondary/65'],
             ['02', 'factTwoTitle', 'factTwoBody', 'bg-accent/20'],
             ['03', 'factThreeTitle', 'factThreeBody', 'bg-[hsl(var(--chart-4))]/15'],
             ['04', 'factFourTitle', 'factFourBody', 'bg-muted/80'],
          ].map(([number, title, body, color]) => (
            <article key={number} className={`min-h-[245px] rounded-[1.6rem] ${color} p-6 transition-transform duration-300 hover:-translate-y-1`} data-testid={`card-fact-${number}`}>
              <div className="flex items-center justify-between"><span className="font-mono-ui text-xs text-primary/60">{number}</span><ArrowUpLeft className="h-4 w-4 text-primary/50" /></div>
              <div className="mt-16"><h3 className="font-arabic text-lg font-bold text-primary">{t(title)}</h3><p className="mt-3 text-sm leading-7 text-primary/70">{t(body)}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-5 mb-6 overflow-hidden rounded-[2rem] bg-primary px-6 py-16 text-primary-foreground sm:mx-8 sm:px-12 sm:py-20 lg:mx-auto lg:max-w-7xl lg:px-20">
        <div className="relative z-10 max-w-2xl">
          <p className="font-mono-ui text-xs uppercase tracking-[.2em] text-accent">{t('ctaKicker')}</p>
          <h2 className="mt-5 whitespace-pre-line font-arabic text-3xl font-bold leading-[1.3] tracking-[-.06em] sm:text-5xl">{t('ctaTitle')}</h2>
          <p className="mt-6 max-w-lg text-sm leading-8 text-primary-foreground/70 sm:text-base">{t('ctaBody')}</p>
          <Link href="/sign-up" className="mt-8 inline-flex items-center gap-3 rounded-full bg-accent px-6 py-3.5 text-sm font-bold text-accent-foreground transition-all hover:-translate-y-1 hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary" data-testid="link-create-account-cta">
            {t('createAccount')} <Arrow className="h-4 w-4" />
          </Link>
        </div>
        <div className="pointer-events-none absolute -mt-40 ms-[55%] hidden h-96 w-96 rounded-full border border-accent/20 lg:block"><div className="absolute inset-10 rounded-full border border-accent/20"><div className="absolute inset-10 rounded-full bg-accent/10" /></div></div>
      </section>
      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <Brand /><span>{t('footerNote')}</span>
      </footer>
    </main>
  );
}
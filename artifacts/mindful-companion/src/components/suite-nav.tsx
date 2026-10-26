import { Link, useLocation } from 'wouter';
import { useI18n } from '@/lib/i18n';
import { aftaHubCopy } from '@/lib/afta-features';
import './suite-nav.css';

const AFTA_PATHS = ['/dashboard', '/daily', '/declutter', '/organize-thoughts', '/daily-questions', '/onboarding'];

export function SuiteNav() {
  const [location] = useLocation();
  const { lang } = useI18n();
  if (!AFTA_PATHS.some((p) => location === p || location.startsWith(p + '/'))) return null;
  const c = aftaHubCopy[lang];
  const items = [
    { href: '/uf30/afta', label: c.hub, id: 'hub' },
    { href: '/dashboard', label: lang === 'ar' ? 'المساحة' : 'Workspace', id: 'dashboard' },
    { href: '/daily', label: lang === 'ar' ? 'اليوم' : 'Daily', id: 'daily' },
    { href: '/uf30/focus', label: 'UF30', id: 'uf30' },
  ];
  return <nav className="suite-nav" dir={lang === 'ar' ? 'rtl' : 'ltr'} aria-label={c.suite} data-testid="nav-suite">
    {items.map((i) => <Link key={i.id} href={i.href} aria-current={location === i.href ? 'page' : undefined} data-testid={`link-suite-${i.id}`}>{i.label}</Link>)}
  </nav>;
}

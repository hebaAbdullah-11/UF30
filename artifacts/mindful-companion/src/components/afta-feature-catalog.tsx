import { ArrowLeft, ArrowRight, CalendarCheck, Layers, LayoutDashboard, Sparkles, UserRound, Wind } from 'lucide-react';
import { Link } from 'wouter';
import { AFTA_FEATURES, aftaHubCopy, type AftaFeature, type AftaFeatureId, type AftaLang } from '@/lib/afta-features';

const icons: Record<AftaFeatureId, typeof Wind> = {
  daily: CalendarCheck, declutter: Wind, organize: Layers, questions: Sparkles, portal: UserRound, dashboard: LayoutDashboard,
};

export function AftaFeatureCard({ feature, lang }: { feature: AftaFeature; lang: AftaLang }) {
  const Icon = icons[feature.id];
  const c = aftaHubCopy[lang];
  return <Link href={feature.path} className="uf-afta-card" data-testid={`card-afta-${feature.id}`} aria-label={`${c.open}: ${feature.title[lang]}`}>
    <span className="uf-afta-card-top"><span className="uf-afta-icon"><Icon size={19}/></span><b>{feature.index}</b></span>
    <strong>{feature.title[lang]}</strong>
    <span className="uf-afta-body">{feature.body[lang]}</span>
    <span className="uf-afta-tags">{feature.tags[lang].map((tag) => <em key={tag}>{tag}</em>)}</span>
    <span className="uf-afta-open">{c.open} {lang === 'ar' ? <ArrowLeft size={15}/> : <ArrowRight size={15}/>}</span>
  </Link>;
}

export function AftaFeatureCatalog({ lang, compact = false }: { lang: AftaLang; compact?: boolean }) {
  const c = aftaHubCopy[lang];
  return <section className={`uf-afta-catalog${compact ? ' compact' : ''}`} aria-labelledby={`afta-catalog-${compact ? 'c' : 'f'}`} data-testid="section-afta-catalog">
    <div className="uf-afta-catalog-head">
      <span className="uf-eyebrow"><i/> AFTA</span>
      <h2 id={`afta-catalog-${compact ? 'c' : 'f'}`}>{c.catalogTitle}</h2>
      <p>{c.catalogBody} {compact && <Link href="/uf30/afta" className="uf-back-link" data-testid="link-catalog-hub">{c.hub}</Link>}</p>
    </div>
    <div className="uf-afta-grid">{AFTA_FEATURES.map((f) => <AftaFeatureCard key={f.id} feature={f} lang={lang}/>)}</div>
  </section>;
}

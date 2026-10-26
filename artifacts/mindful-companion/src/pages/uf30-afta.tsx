import { useEffect } from 'react';
import { ArrowUpRight, Database, KeyRound, MonitorSmartphone } from 'lucide-react';
import { Link } from 'wouter';
import { useI18n } from '@/lib/i18n';
import { aftaHubCopy } from '@/lib/afta-features';
import { AftaFeatureCatalog } from '@/components/afta-feature-catalog';
import './uf30.css';

export default function UF30Afta() {
  const { lang, setLang } = useI18n();
  const ar = lang === 'ar';
  const c = aftaHubCopy[lang];

  useEffect(() => {
    const prevTitle = document.title;
    document.title = ar ? 'مركز أفتا · UF30' : 'AFTA hub · UF30';
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const created = !meta;
    if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.appendChild(meta); }
    const prevDesc = meta.content;
    meta.content = c.metaDesc;
    return () => { document.title = prevTitle; if (created) meta?.remove(); else if (meta) meta.content = prevDesc; };
  }, [ar, c.metaDesc]);

  return <main className="uf30" dir={ar ? 'rtl' : 'ltr'} data-testid="page-uf30-afta">
    <div className="uf-workspace">
      <header className="uf-workspace-header">
        <Link href="/" className="uf-brand" aria-label="UF30" data-testid="link-afta-hub-home"><span className="uf-mark">U</span><span className="uf-brand-copy">UF30<small>{c.navLabel}</small></span></Link>
        <nav className="uf-workspace-nav" aria-label={c.ufTitle} data-testid="nav-afta-hub-uf30">
          <Link href="/uf30/focus" data-testid="link-hub-focus">{c.ufFocus}</Link>
          <Link href="/uf30/register" data-testid="link-hub-register">{c.ufRegister}</Link>
          <Link href="/uf30/afta" aria-current="page" data-testid="link-hub-self">{c.navLabel}</Link>
        </nav>
        <div className="uf-actions">
          <button className="uf-lang" onClick={() => setLang(ar ? 'en' : 'ar')} aria-label={ar ? 'Switch to English' : 'التبديل إلى العربية'} data-testid="button-afta-hub-language">{ar ? 'EN' : 'عربي'}</button>
        </div>
      </header>

      <section className="uf-afta-hero" data-testid="section-afta-hero">
        <span className="uf-eyebrow"><i/> {c.eyebrow}</span>
        <h1>{c.hubTitle}</h1>
        <p>{c.hubBody}</p>
      </section>

      <AftaFeatureCatalog lang={lang}/>

      <div className="uf-afta-info">
        <section className="uf-panel" data-testid="panel-afta-account">
          <span className="uf-kicker"><KeyRound size={13}/> {c.accountTitle}</span>
          <h2>{c.accountTitle}</h2><p>{c.accountBody}</p>
          <div className="uf-saved-actions" style={{ justifyContent: 'flex-start' }}>
            <Link href="/sign-in" className="uf-button" data-testid="link-afta-sign-in">{c.signIn}</Link>
            <Link href="/sign-up" className="uf-button secondary" data-testid="link-afta-sign-up">{c.signUp}</Link>
          </div>
          <p style={{ marginTop: 16, fontSize: 12 }}>{c.mediaNote}</p>
        </section>
        <section className="uf-panel" data-testid="panel-afta-data">
          <span className="uf-kicker">{c.dataTitle}</span><h2>{c.dataTitle}</h2>
          <div className="uf-storage-note" style={{ marginBottom: 10 }}><MonitorSmartphone size={18}/><span>{c.ufData}</span></div>
          <div className="uf-storage-note"><Database size={18}/><span>{c.aftaData}</span></div>
          <p style={{ marginTop: 14, fontSize: 12 }}>{c.noShare}</p>
        </section>
      </div>

      <footer className="uf-footer" style={{ marginTop: 45, borderRadius: 18, padding: '22px 25px' }}>
        <div className="uf-footer-row"><Link href="/" data-testid="link-afta-hub-back">{c.back}</Link><Link href="/afta" data-testid="link-afta-hub-legacy">{c.legacy} <ArrowUpRight size={14}/></Link></div>
      </footer>
    </div>
  </main>;
}

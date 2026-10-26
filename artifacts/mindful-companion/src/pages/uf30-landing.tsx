import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Brain, CalendarDays, Clock3, GraduationCap, ShieldCheck, UsersRound, Workflow } from 'lucide-react';
import { Link } from 'wouter';
import { useI18n } from '@/lib/i18n';
import { uf30Copy, type UF30CopyKey } from '@/lib/uf30-copy';
import './uf30.css';

export default function UF30Landing() {
  const { lang, setLang } = useI18n();
  const ar = lang === 'ar';
  const t = (key: UF30CopyKey) => uf30Copy[lang][key];
  return <main className="uf30" dir={ar ? 'rtl' : 'ltr'} data-testid="page-uf30-landing">
    <div className="uf-wrap">
      <header className="uf-header">
        <Link href="/" className="uf-brand" data-testid="link-uf30-home"><span className="uf-mark">U</span><span className="uf-brand-copy">UF30<small>{t('footer')}</small></span></Link>
        <nav className="uf-nav" aria-label={ar ? 'التنقل الرئيسي' : 'Main navigation'} data-testid="nav-uf30">
          <a href="#program" data-testid="link-uf30-program">{t('navProgram')}</a><a href="#audience" data-testid="link-uf30-audience">{t('navWho')}</a><Link href="/uf30/afta" data-testid="link-uf30-afta-nav">{ar ? 'أدوات أفتا' : 'AFTA tools'}</Link><Link href="/uf30/organization" data-testid="link-uf30-organization">{ar ? 'للجهات' : 'For institutions'}</Link>
        </nav>
        <div className="uf-actions">
          <Link href="/uf30/afta" className="uf-afta-link" data-testid="link-uf30-afta-action">{ar ? 'أفتا' : 'AFTA'}</Link>
          <button className="uf-lang" onClick={() => setLang(ar ? 'en' : 'ar')} data-testid="button-uf30-language" aria-label={ar ? 'Switch to English' : 'التبديل إلى العربية'}>{ar ? 'EN' : 'عربي'}</button>
          <Link href="/uf30/register" className="uf-button" data-testid="link-uf30-register">{t('join')} <ArrowUpRight size={16}/></Link>
        </div>
      </header>
      <section className="uf-hero" aria-labelledby="uf-hero-title" data-testid="section-uf30-hero">
        <div className="uf-hero-copy soft-reveal">
          <span className="uf-eyebrow"><i/> {t('programLabel')}</span>
          <h1 id="uf-hero-title">{t('hero')}</h1>
          <p>{t('heroBody')}</p>
          <div className="uf-hero-buttons">
            <Link href="/uf30/register" className="uf-button" data-testid="link-hero-register">{t('start')} {ar ? <ArrowLeft size={17}/> : <ArrowRight size={17}/>}</Link>
            <Link href="/uf30/organization" className="uf-button secondary" data-testid="link-hero-organization">{ar ? 'برنامج الجهات' : 'Institution program'} {ar ? <ArrowLeft size={17}/> : <ArrowRight size={17}/>}</Link>
            <a href="#program" className="uf-button secondary" data-testid="link-hero-explore">{t('navProgram')} <ArrowDown size={16}/></a>
          </div>
        </div>
        <div className="uf-orbit float-gently" aria-hidden="true"><span className="uf-orbit-dot"/><div className="uf-orbit-inner"><div><span>UF</span>UNRESTRICTED<br/>FOCUS</div></div></div>
      </section>
      <section className="uf-section" id="program" data-testid="section-uf30-program">
        <div className="uf-section-head"><span className="uf-eyebrow"><i/> {t('formatLabel')}</span><h2>{t('overview')}</h2><p>{t('overviewBody')}</p></div>
        <div className="uf-program">
          <article className="uf-workshop" data-testid="card-uf30-workshop"><span className="uf-count">{t('startHere')}</span><h3>{t('intro')}</h3><p>{t('introBody')}</p><div style={{marginTop:28,display:'flex',alignItems:'center',gap:9}}><Clock3 size={17}/><strong>{t('introLength')}</strong></div></article>
          <div className="uf-sessions">
            <article className="uf-session" data-testid="card-uf30-session-1"><span className="uf-session-icon"><CalendarDays size={20}/></span><div><strong>{t('weekly')}</strong><span>{t('weeklyBody')}</span></div><b>{t('weeklyLength')}</b></article>
            <article className="uf-session" data-testid="card-uf30-session-2"><span className="uf-session-icon"><Workflow size={20}/></span><div><strong>{t('sessionNumber')}</strong><span>{t('sessionHours')}</span></div><b>{t('sessionDuration')}</b></article>
          </div>
        </div>
        <article className="uf-assistant" style={{marginTop:24}} data-testid="card-uf30-assistant">
          <div><span className="uf-eyebrow"><i/> {t('dailyLabel')}</span><h3>{t('assistant')}</h3><p>{t('assistantBody')}</p></div>
          <div className="uf-assistant-visual" aria-hidden="true"><Brain size={42} strokeWidth={1.35}/></div>
        </article>
      </section>
    </div>
    <section id="audience" className="uf-audience" data-testid="section-uf30-audience"><div className="uf-wrap uf-audience-row">
      <div className="uf-audience-title">{t('audience')}</div>
      <div className="uf-audience-item"><UsersRound size={19}/>{t('adults')}</div><div className="uf-audience-item"><Workflow size={19}/>{t('workers')}</div><div className="uf-audience-item"><GraduationCap size={20}/>{t('students')}</div>
    </div></section>
    <div className="uf-wrap">
      <section className="uf-section uf-eligibility" data-testid="section-uf30-eligibility">
        <div><span className="uf-eyebrow"><i/> {t('openLabel')}</span><h2>{t('eligibility')}</h2><p>{t('eligibilityBody')}</p></div>
        <div className="uf-age-mark"><div><strong>{ar ? 'مسار للبالغين' : 'A program for adults'}</strong><span>{ar ? 'أكثر من 20 عامًا' : 'Over 20 years old'}</span></div><ShieldCheck size={27}/></div>
      </section>
    </div>
    <section className="uf-cta" data-testid="section-uf30-cta"><div><h2>{t('ctaTitle')}</h2><p>{t('ctaBody')}</p></div><Link href="/uf30/register" className="uf-button" data-testid="link-cta-register">{t('join')} {ar ? <ArrowLeft size={17}/> : <ArrowRight size={17}/>}</Link></section>
    <footer className="uf-footer"><div className="uf-wrap uf-footer-row"><div className="uf-brand"><span className="uf-mark">U</span><span className="uf-brand-copy">UF30<small>{t('footer')}</small></span></div><small>{t('footer')}</small><Link href="/afta" data-testid="link-legacy-afta">{t('legacy')} <ArrowUpRight size={14}/></Link></div></footer>
  </main>;
}

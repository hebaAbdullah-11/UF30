import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, LockKeyhole, RotateCcw, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'wouter';
import { Form } from '@/components/ui/form';
import { useI18n } from '@/lib/i18n';
import { dailyCopy } from '@/lib/daily-copy';
import { aftaHubCopy } from '@/lib/afta-features';
import { uf30Copy, type UF30CopyKey } from '@/lib/uf30-copy';
import { UF30_REGISTRATION_STORAGE_KEY as STORAGE_KEY } from '@/lib/uf30-workspace-data';
import { AftaFeatureCatalog } from '@/components/afta-feature-catalog';
import './uf30.css';

type Answers = { focusTime: string; distraction: string; starting: string; organizationCode: string; privacyConsent: boolean; notificationConsent: boolean };
const EMPTY_ANSWERS: Answers = { focusTime: '', distraction: '', starting: '', organizationCode: '', privacyConsent: false, notificationConsent: false };
type Option = { id: string; key: UF30CopyKey };
const groups: { name: keyof Pick<Answers, 'focusTime'|'distraction'|'starting'>; title: UF30CopyKey; hint: UF30CopyKey; options: Option[] }[] = [
  { name:'focusTime', title:'q1', hint:'q1hint', options:[{id:'morning',key:'morning'},{id:'midday',key:'midday'},{id:'evening',key:'evening'},{id:'varies',key:'varies'}] },
  { name:'distraction', title:'q2', hint:'q2hint', options:[{id:'noise',key:'noise'},{id:'notifications',key:'notifications'},{id:'unclear',key:'unclear'},{id:'many',key:'many'},{id:'interruptions',key:'interruptions'}] },
  { name:'starting', title:'q3', hint:'q3hint', options:[{id:'small',key:'small'},{id:'plan',key:'plan'},{id:'company',key:'company'},{id:'quiet',key:'quiet'},{id:'deadline',key:'deadline'}] },
];
function readSaved(): Answers | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Answers>;
    if (typeof value.focusTime === 'string' && typeof value.distraction === 'string' && typeof value.starting === 'string' && value.privacyConsent === true) {
      return { focusTime:value.focusTime, distraction:value.distraction, starting:value.starting, organizationCode:typeof value.organizationCode === 'string' ? value.organizationCode : '', privacyConsent:true, notificationConsent:value.notificationConsent === true };
    }
    return null;
  } catch { return null; }
}
export default function UF30Register() {
  const { lang, setLang } = useI18n();
  const ar = lang === 'ar';
  const t = (key: UF30CopyKey) => uf30Copy[lang][key];
  const [saved, setSaved] = useState<Answers | null>(() => readSaved());
  const [editing, setEditing] = useState(!saved);
  const [error,setError] = useState<'required'|'storageError'|null>(null);
  const form = useForm<Answers>({ defaultValues: EMPTY_ANSWERS });
  const focusTime = form.watch('focusTime');
  const distraction = form.watch('distraction');
  const starting = form.watch('starting');
  const privacyRegistration = form.register('privacyConsent', { required: true });
  const setForm = (answer: Answers) => { form.reset(answer); setError(null); };
  const beginEdit = () => { if (saved) setForm(saved); setEditing(true); };
  const clearSaved = () => {
    if (!window.confirm(t('clearConfirm'))) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
      setSaved(null);
      setEditing(true);
      form.reset(EMPTY_ANSWERS);
      setError(null);
    } catch {
      setError('storageError');
    }
  };
  const save = form.handleSubmit((values) => {
    const next: Answers = { ...values, organizationCode: values.organizationCode.trim(), privacyConsent: true };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSaved(next);
      setEditing(false);
      setError(null);
    } catch {
      setError('storageError');
    }
  }, () => setError('required'));
  return <main className="uf30" dir={ar ? 'rtl' : 'ltr'} data-testid="page-uf30-register">
    <div className="uf-wrap">
      <header className="uf-header uf-register-head">
        <Link href="/" className="uf-brand" data-testid="link-register-home"><span className="uf-mark">U</span><span className="uf-brand-copy">UF30<small>{t('footer')}</small></span></Link>
          <div className="uf-actions"><button className="uf-lang" onClick={() => setLang(ar ? 'en' : 'ar')} data-testid="button-register-language">{ar ? 'EN' : 'عربي'}</button><Link href="/uf30/afta" className="uf-button ghost uf-afta-entry" data-testid="link-register-afta-hub">{aftaHubCopy[lang].catalogTitle}</Link></div>
      </header>
    </div>
    <div className="uf-register-shell">
      <Link href="/" className="uf-back-link" data-testid="link-register-back">{ar ? <ChevronRight size={17}/> : <ChevronLeft size={17}/>} {t('backToProgram')}</Link>
      <div className="uf-register-title"><span className="uf-eyebrow"><i/> UF30 · INTRODUCTION</span><h1>{t('registerTitle')}</h1><p>{t('registerBody')}</p></div>
      <section className="uf-form-card" aria-live="polite" data-testid="panel-uf30-registration">
        {saved && !editing ? <div className="uf-saved" data-testid="status-uf30-saved">
          <div className="uf-saved-icon"><Check size={29}/></div><span className="uf-eyebrow"><i/> UF30</span><h2>{t('savedTitle')}</h2><p>{t('savedBody')}</p>
          <div className="uf-summary" data-testid="summary-uf30-answers">
            {groups.map(group => { const selected = group.options.find(option => option.id === saved[group.name]); return <p key={group.name}><strong>{t(group.title)} </strong>{selected ? t(selected.key) : ''}</p>; })}
            {saved.organizationCode && <p><strong>{t('code')} </strong>{saved.organizationCode}</p>}
            <p><strong>{ar ? 'الإشعارات' : 'Notifications'} </strong>{saved.notificationConsent ? (ar ? 'اختياري: نعم' : 'Optional: yes') : (ar ? 'اختياري: لا' : 'Optional: no')}</p>
          </div>
          <div className="uf-saved-actions"><button className="uf-button secondary" onClick={beginEdit} data-testid="button-edit-answers"><RotateCcw size={16}/>{t('edit')}</button><button className="uf-button ghost" onClick={clearSaved} data-testid="button-clear-answers"><Trash2 size={16}/>{t('clear')}</button></div>
          <div className="uf-saved-actions" style={{marginTop:12}}><Link href="/uf30/focus" className="uf-button" data-testid="link-uf30-workspace">{ar ? 'الانتقال إلى مساحة UF30' : 'Enter the UF30 workspace'} <ArrowRight size={16}/></Link></div>
          <Link href="/daily" className="uf-button" style={{marginTop:16,display:'inline-flex'}} data-testid="link-uf30-afta-daily">{dailyCopy[lang].ufLink} {ar ? <ArrowLeft size={17}/> : <ArrowRight size={17}/>}</Link>
          <p style={{fontSize:12,color:'var(--u-muted)',marginTop:6}}>{dailyCopy[lang].ufLinkBody}</p>
          <div className="uf-safe-note"><LockKeyhole size={16}/><span>{t('savedBody')}</span></div>
        </div> : <Form {...form}><form onSubmit={save} noValidate data-testid="form-uf30-registration">
          <div className="uf-progress" aria-label={ar ? 'ثلاثة أسئلة' : 'Three questions'} data-testid="status-uf30-progress"><b>01—03</b><span className="active"/><span className="active"/><span className="active"/></div>
          {groups.map((group,index) => {
            const registration = form.register(group.name, { required: true });
            return <fieldset className="uf-question" key={group.name} data-testid={`question-uf30-${index+1}`}>
            <legend>{index+1}. {t(group.title)}</legend><p>{t(group.hint)}</p>
            <div className="uf-options">{group.options.map(option => { const checked = ({focusTime,distraction,starting}[group.name] === option.id); return <div className="uf-option" key={option.id}>
              <input {...registration} id={`uf30-${group.name}-${option.id}`} type="radio" value={option.id} checked={checked} onChange={(event) => { registration.onChange(event); setError(null); }} data-testid={`input-${group.name}-${option.id}`}/>
              <label htmlFor={`uf30-${group.name}-${option.id}`} data-testid={`label-${group.name}-${option.id}`}><span className="uf-radio-dot"/>{t(option.key)}</label>
            </div>; })}</div>
          </fieldset>;
          })}
          <label className="uf-code-label" htmlFor="uf30-organization-code">{t('code')}</label>
          <input id="uf30-organization-code" className="uf-code-input" {...form.register('organizationCode', { maxLength: 80 })} data-testid="input-organization-code"/>
          <p className="uf-code-help" data-testid="text-organization-code-note">{t('codeHint')}</p>
          <p className="uf-code-help" data-testid="text-uf30-data-minimization">{t('localPrivacy')}</p>
          <label className="uf-consent required"><input {...privacyRegistration} type="checkbox" onChange={(event) => { privacyRegistration.onChange(event); setError(null); }} data-testid="input-privacy-consent"/><span><strong>{ar ? 'موافقة مطلوبة · ' : 'Required consent · '}</strong>{t('privacy')}</span></label>
          <label className="uf-consent"><input type="checkbox" {...form.register('notificationConsent')} data-testid="input-notification-consent"/><span>{t('notice')}</span></label>
          {error && <p className="uf-form-error" role="alert" data-testid="status-uf30-form-error">{t(error)}</p>}
          <div className="uf-save-row"><button type="submit" className="uf-button" data-testid="button-save-registration">{t('submit')} {ar ? <ArrowLeft size={17}/> : <ArrowRight size={17}/>}</button></div>
          <div className="uf-safe-note" data-testid="text-uf30-local-storage"><LockKeyhole size={16}/><span>{t('savedBody')}</span></div>
          {saved && <button type="button" className="uf-button ghost" style={{marginTop:13}} onClick={() => { setEditing(false); setForm(saved); }} data-testid="button-cancel-edit">{ar ? 'إلغاء التعديل' : 'Cancel editing'}</button>}
        </form></Form>}
      </section>
      <p style={{textAlign:'center',color:'var(--u-muted)',fontSize:12,marginTop:20}} data-testid="text-uf30-no-server">{t('savedBody')}</p>
      <AftaFeatureCatalog lang={lang} compact/>
    </div>
  </main>;
}

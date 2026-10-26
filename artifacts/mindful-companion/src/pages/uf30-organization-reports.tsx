import { Link } from 'wouter';
import { ArrowLeft, ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useGetUf30InstitutionReport } from '@workspace/api-client-react';
import { getGetUf30InstitutionReportQueryKey } from '@workspace/api-client-react';
import { useI18n } from '@/lib/i18n';
import './uf30.css';

const enReportCopy = {title:'Institution impact report',sub:'Anonymous group outcomes only. No individual records or answers are included.',measures:'Permitted measures',metric:['On-time completion','Punctuality','Manager rating','Participant satisfaction'],phases:['Baseline','After session four','After two months'],enrolled:'Registrations',discount:'Institution discount',responses:'responses',withheld:'Results are withheld until the minimum group size is reached.',no:'No results are available yet.',error:'No results are available. We could not load the protected report.',forbidden:'No reporting role is assigned to this account. Contact your UF30 program administrator for access.',retry:'Try again',back:'Institution information',privacy:'Reports include aggregate outcomes only. Groups with fewer than 10 responses are withheld; their count and values are not shown.',loading:'Loading protected report…'};
const arReportCopy: typeof enReportCopy = {title:'تقرير أثر المؤسسة',sub:'نتائج جماعية مجهولة فقط. لا يتضمن التقرير سجلات أو إجابات فردية.',measures:'المقاييس المسموح بها',metric:['إكمال المهام في موعدها','الالتزام بالمواعيد','تقييم المدير','رضا المشاركين'],phases:['خط الأساس','بعد الجلسة الرابعة','بعد شهرين'],enrolled:'التسجيلات',discount:'خصم المؤسسة',responses:'استجابة',withheld:'تم حجب النتائج حتى بلوغ الحد الأدنى لحجم المجموعة.',no:'لا توجد نتائج متاحة حتى الآن.',error:'لا توجد نتائج متاحة. تعذر تحميل التقرير المحمي.',forbidden:'لم يتم تعيين دور خاص بالتقارير لهذا الحساب. تواصل مع مسؤول برنامج UF30 لطلب الوصول.',retry:'إعادة المحاولة',back:'معلومات المؤسسة',privacy:'يتضمن التقرير نتائج مجمعة فقط. يتم حجب المجموعات التي تقل عن 10 استجابات، دون إظهار العدد أو القيم.',loading:'جارٍ تحميل التقرير المحمي…'};
const copy = {en:enReportCopy, ar:arReportCopy};
export default function UF30OrganizationReports(){
 const {lang,setLang}=useI18n();const ar=lang==='ar';const c=copy[lang];
 const report=useGetUf30InstitutionReport({query:{queryKey:getGetUf30InstitutionReportQueryKey(),retry:false}});
 const err=report.error as {status?:number;response?:{status?:number}}|null;
 const forbidden=err?.status===403||err?.response?.status===403;
 const phaseLabel=(p:string)=>p==='baseline'?c.phases[0]:p==='after_session_four'?c.phases[1]:c.phases[2];
 const metrics=(a:NonNullable<NonNullable<typeof report.data>['phases'][number]['averages']>)=>[a.onTimeCompletion,a.punctuality,a.managerRating,a.participantSatisfaction];
 return <main className="uf30 org-page" dir={ar?'rtl':'ltr'} data-testid="page-uf30-organization-reports"><div className="uf-wrap">
  <header className="uf-header"><Link href="/" className="uf-brand" data-testid="link-report-home"><span className="uf-mark">U</span><span className="uf-brand-copy">UF30<small>UNRESTRICTED FOCUS</small></span></Link><div className="org-header-actions"><Link href="/uf30/organization" className="org-back" data-testid="link-report-back">{ar?<ArrowRight size={16}/>:<ArrowLeft size={16}/>} {c.back}</Link><button className="uf-lang" onClick={()=>setLang(ar?'en':'ar')} data-testid="button-report-language">{ar?'EN':'عربي'}</button></div></header>
  <section className="org-report-hero"><span className="org-shield"><LockKeyhole size={22}/></span><span className="uf-eyebrow"><i/>{ar?'مساحة مؤسسية محمية':'PROTECTED INSTITUTION VIEW'}</span><h1>{report.data?(ar?report.data.institution.nameArabic:report.data.institution.nameEnglish):c.title}</h1><p>{c.sub}</p><div className="org-privacy-strip"><ShieldCheck size={20}/><span>{c.privacy}</span></div></section>
  {report.isLoading&&<div className="org-report-skeleton" data-testid="status-report-loading"><i/><i/><i/></div>}
  {report.isError&&<div className={`org-report-state ${forbidden?'org-forbidden':''}`} role="alert" data-testid={forbidden?'status-report-forbidden':'status-report-error'}><LockKeyhole size={25}/><h2>{forbidden?c.forbidden:c.error}</h2>{!forbidden&&<button className="uf-button ghost" onClick={()=>report.refetch()} data-testid="button-retry-report">{c.retry}</button>}</div>}
  {report.data&&<section className="org-report-content" data-testid="content-aggregate-report">
   <div className="org-report-summary"><article><span>{c.enrolled}</span><strong data-testid="value-enrolled-count">{report.data.enrolledCount}</strong></article><article><span>{c.discount}</span><strong>{report.data.institution.discountPercent}%</strong></article><article><span>{c.measures}</span><strong>04</strong></article></div>
    {report.data.enrolledCount===0?<div className="org-report-state" role="status" data-testid="status-report-empty"><h2>{c.no}</h2></div>:<div className="org-phases">{report.data.phases.map((item,index)=>{
    const suppressed=item.suppressed||item.responseCount===null||item.responseCount<report.data!.minimumGroupSize||!item.averages;
    return <article className="org-phase-card" key={item.phase} data-testid={`card-report-phase-${item.phase}`}>
      <div className="org-phase-heading"><span className="org-phase-index">0{index+1}</span><div><span className="uf-kicker">{c.phases[index]}</span><h2>{phaseLabel(item.phase)}</h2></div>{!suppressed&&<span className="org-count">{item.responseCount} {c.responses}</span>}</div>
      {suppressed?<div className="org-withheld" role="status" data-testid={`status-withheld-${item.phase}`}><LockKeyhole size={18}/><span>{c.withheld}</span></div>:
       <div className="org-results">{metrics(item.averages!).map((value,i)=><div className="org-result-row" key={i} data-testid={`metric-${item.phase}-${i}`}><span>{c.metric[i]}</span><strong>{value===null?'—':`${Number(value).toFixed(1)}${i<2?'%':' / 5'}`}</strong></div>)}</div>}
    </article>;
   })}</div>}
   <p className="org-report-note"><ShieldCheck size={16}/>{c.privacy}</p>
  </section>}
 </div></main>;
}

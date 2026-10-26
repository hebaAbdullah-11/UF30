export type AftaFeatureId = 'daily' | 'declutter' | 'organize' | 'questions' | 'portal' | 'dashboard';
export type AftaLang = 'ar' | 'en';

export type AftaFeature = {
  id: AftaFeatureId;
  path: string;
  index: string;
  title: Record<AftaLang, string>;
  body: Record<AftaLang, string>;
  tags: Record<AftaLang, string[]>;
  optional?: boolean;
};

export const AFTA_FEATURES: AftaFeature[] = [
  { id: 'daily', path: '/daily', index: '01',
    title: { ar: 'اليوم المنظّم', en: 'Daily planner' },
    body: { ar: 'خطّط مهام يومك، اضبط التذكيرات، وراجع الأفكار المقترحة قبل أن تصبح مهامًا بموافقتك فقط.', en: 'Plan the day, set reminders, and review suggested ideas before they become tasks, only with your approval.' },
    tags: { ar: ['مهام', 'تذكيرات', 'صندوق أفكار'], en: ['Tasks', 'Reminders', 'Idea inbox'] } },
  { id: 'declutter', path: '/declutter', index: '02',
    title: { ar: 'لمّ الشتات', en: 'Declutter chat' },
    body: { ar: 'محادثة بالذكاء الاصطناعي لتفريغ ما في رأسك وتهدئة الزحام الذهني.', en: 'An AI conversation for emptying your head and easing mental clutter.' },
    tags: { ar: ['محادثة', 'ذكاء اصطناعي'], en: ['Chat', 'AI'] } },
  { id: 'organize', path: '/organize-thoughts', index: '03',
    title: { ar: 'ترتيب الأفكار', en: 'Organize thoughts' },
    body: { ar: 'محادثة تساعدك على تنظيم الأفكار وترتيب الأولويات وتحويلها إلى مخطط تدفق.', en: 'A conversation that helps organize ideas, set priorities, and turn them into a flowchart.' },
    tags: { ar: ['أولويات', 'مخطط تدفق'], en: ['Priorities', 'Flowchart'] } },
  { id: 'questions', path: '/daily-questions', index: '04',
    title: { ar: 'الأسئلة اليومية', en: 'Daily questions' },
    body: { ar: 'أسئلة يومية قصيرة، مع تأمل بالذكاء الاصطناعي عندما تطلبه صراحة.', en: 'Short daily questions, with an AI reflection only when you explicitly ask for it.' },
    tags: { ar: ['تأمل', 'عند الطلب'], en: ['Reflection', 'On request'] } },
  { id: 'portal', path: '/user-portal', index: '05', optional: true,
    title: { ar: 'البوابة الشخصية', en: 'Personal portal' },
    body: { ar: 'تعريف شخصي وتقييم ذاتي اختياري وخطوات البدء الحالية.', en: 'Personal introduction, optional self-assessment, and current onboarding.' },
    tags: { ar: ['اختياري', 'تعريف'], en: ['Optional', 'Introduction'] } },
  { id: 'dashboard', path: '/dashboard', index: '06',
    title: { ar: 'مساحة أفتا', en: 'AFTA workspace' },
    body: { ar: 'لوحتك الرئيسية للوصول إلى كل أدوات أفتا من حسابك.', en: 'Your home base for reaching every AFTA tool from your account.' },
    tags: { ar: ['لوحة', 'حساب'], en: ['Home', 'Account'] } },
];

export const aftaHubCopy = {
  ar: {
    navLabel: 'أفتا', hubTitle: 'كل أدوات أفتا في مكان واحد', eyebrow: 'UF30 · أفتا',
    hubBody: 'أدوات أفتا الحالية متاحة من داخل مشروع UF30. تصفح بحرية، وافتح أي أداة عندما تكون مستعدًا.',
    open: 'فتح', catalogTitle: 'أدوات أفتا', catalogBody: 'ست أدوات تعمل الآن بحسابك في أفتا.',
    accountTitle: 'حساب واحد مشترك', accountBody: 'الأدوات التي تحفظ بياناتك تتطلب تسجيل الدخول بحساب أفتا الحالي. لا تحتاج إلى التسجيل في UF30 لاستخدامها، ويمكنك تصفح هذه الصفحة وأدوات UF30 دون حساب.',
    signIn: 'تسجيل الدخول', signUp: 'إنشاء حساب',
    dataTitle: 'أين تُحفظ بياناتك', ufData: 'UF30: إعدادات وجلسات وتسجيل تُحفظ على هذا الجهاز فقط، وحذفها لا يمس حسابك في أفتا.',
    aftaData: 'أفتا: مهام ومحادثات وإجابات مرتبطة بحسابك على الخادم، وتُدار من داخل أفتا وحدها.',
    noShare: 'لا تُنقل بيانات بين المساحتين، ولا تعني موافقة إحداهما موافقة على الأخرى.',
    ufTitle: 'مساحة UF30', ufFocus: 'التركيز', ufRegister: 'التعريف', legacy: 'صفحة أفتا التعريفية',
    mediaNote: 'ميزات الصوت والوسائط الموجودة تبقى كما هي داخل المحادثات.',
    suite: 'التنقل بين المساحات', hub: 'مركز أفتا', back: 'العودة إلى UF30',
    metaDesc: 'مركز أدوات أفتا داخل UF30: الجدول اليومي، لمّ الشتات، ترتيب الأفكار، الأسئلة اليومية.',
  },
  en: {
    navLabel: 'AFTA', hubTitle: 'Every AFTA tool, in one place', eyebrow: 'UF30 · AFTA',
    hubBody: 'The existing AFTA tools are reachable from inside UF30. Browse freely, open any tool when you are ready.',
    open: 'Open', catalogTitle: 'AFTA tools', catalogBody: 'Six tools that work today with your AFTA account.',
    accountTitle: 'One shared account', accountBody: 'Tools that save your data need you to sign in with your existing AFTA account. UF30 registration is not required, and you can browse this page and the UF30 tools without an account.',
    signIn: 'Sign in', signUp: 'Create account',
    dataTitle: 'Where your data lives', ufData: 'UF30: settings, sessions and introduction are stored on this device only. Clearing them does not touch your AFTA account.',
    aftaData: 'AFTA: tasks, chats and answers belong to your account on the server and are managed inside AFTA only.',
    noShare: 'Nothing is moved between the two, and consent in one is not consent in the other.',
    ufTitle: 'UF30 workspace', ufFocus: 'Focus', ufRegister: 'Introduction', legacy: 'AFTA intro page',
    mediaNote: 'Existing voice and media features stay as they are inside the chats.',
    suite: 'Switch spaces', hub: 'AFTA hub', back: 'Back to UF30',
    metaDesc: 'AFTA tool hub inside UF30: daily planner, declutter, organize thoughts, daily questions.',
  },
} as const;

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Language = 'ar' | 'en';
type Copy = Record<Language, string>;

export const copy: Record<string, Copy> = {
  brand: { ar: 'AFTA', en: 'AFTA' },
  brandTag: { ar: 'AFTA يفهمك', en: 'AFTA gets you' },
  languageArabic: { ar: 'العربية', en: 'Arabic' },
  languageEnglish: { ar: 'English', en: 'English' },
  navHow: { ar: 'كيف يساعدك', en: 'How it helps' },
  navWhy: { ar: 'لماذا AFTA؟', en: 'Why AFTA' },
  signIn: { ar: 'تسجيل الدخول', en: 'Sign in' },
  createAccount: { ar: 'أنشئ حسابك', en: 'Create your account' },
  dashboardNav: { ar: 'الذهاب إلى مساحتي', en: 'Go to my dashboard' },
  heroKicker: { ar: 'مساحة أهدأ لفهم نفسك', en: 'A quieter way to understand yourself' },
  heroTitle: { ar: `AFTA يساعدك على فهم نمطك،\nوترتيب يومك على مقاسك.`, en: `An AI companion that helps you understand your pattern\nand shape a day that fits.` },
  heroBody: { ar: 'AFTA يساعدك على ملاحظة ما يتكرر، وفهم ما تحتاجه، واختيار خطوة واحدة ممكنة — بلا أحكام ولا وصفات جاهزة.', en: 'AFTA helps you notice what repeats, understand what you need, and choose one possible next step — without judgment or ready-made formulas.' },
  heroPrimary: { ar: 'ابدأ بهدوء', en: 'Begin gently' },
  heroSecondary: { ar: 'تعرّف على AFTA', en: 'Meet AFTA' },
  heroNote: { ar: 'مصمم ليبدأ معك من حيث أنت', en: 'Designed to start exactly where you are' },
  rhythmLabel: { ar: 'إيقاع اليوم', en: 'Today’s rhythm' },
  rhythmTitle: { ar: 'مساحة للتنفس', en: 'Room to breathe' },
  rhythmCaption: { ar: 'ملاحظة صغيرة تكفي لتبدأ', en: 'A small note is enough to begin' },
  rhythmOne: { ar: 'طاقة', en: 'Energy' },
  rhythmTwo: { ar: 'تركيز', en: 'Focus' },
  rhythmThree: { ar: 'راحة', en: 'Rest' },
  sectionKicker: { ar: 'ليس عليك أن تصلح نفسك', en: 'You are not a problem to fix' },
  sectionTitle: { ar: `في الأيام المزدحمة،\nنبدأ بملاحظة واحدة.`, en: `On busy days,\nwe start with one observation.` },
  sectionBody: { ar: 'AFTA لا يضيف قائمة أخرى إلى يومك. بل يساعدك على رؤية الإشارات الصغيرة التي قد تضيع وسط الضجيج، ثم يحولها إلى قرار لطيف يناسب طاقتك الآن.', en: 'AFTA does not add another list to your day. It helps you see the small signals that get lost in the noise, then turns them into a gentle decision that fits your energy now.' },
  stepOne: { ar: 'لاحظ', en: 'Notice' },
  stepOneBody: { ar: 'قل ما يحدث كما هو، حتى لو لم تجد الكلمات المناسبة بعد.', en: 'Name what is happening, even if you do not have the right words yet.' },
  stepTwo: { ar: 'افهم', en: 'Understand' },
  stepTwoBody: { ar: 'نبحث معًا عن الأنماط خلف الطاقة، التأجيل، والتركيز.', en: 'Look together for patterns behind energy, avoidance, and focus.' },
  stepThree: { ar: 'اختر', en: 'Choose' },
  stepThreeBody: { ar: 'خطوة صغيرة واضحة، لا خطة مثالية مستحيلة.', en: 'One clear small step, not an impossible perfect plan.' },
  factsKicker: { ar: 'معلومة تستحق اللطف', en: 'A fact worth meeting gently' },
  factsTitle: { ar: 'الدماغ لا يعمل بطريقة واحدة.', en: 'There is no single way for a mind to work.' },
  factsBody: { ar: 'المعرفة لا تختصر الإنسان، لكنها تفتح بابًا لفهم الذات بدل لومها.', en: 'Knowledge does not reduce a person. It opens a door to understanding instead of blame.' },
  factOneTitle: { ar: 'شائع أكثر مما يبدو', en: 'More common than it looks' },
  factOneBody: { ar: 'تقدّر دراسات حديثة أن اضطراب فرط الحركة وتشتت الانتباه يؤثر في نحو 12٪ من السكان.', en: 'Recent studies estimate that ADHD affects roughly 12% of the population.' },
  factTwoTitle: { ar: 'ليس نقصًا في الإرادة', en: 'Not a lack of willpower' },
  factTwoBody: { ar: 'الانتباه يتأثر بالنوم، الضغط، الاهتمام، وبشكل المهمة — لا بالإرادة وحدها.', en: 'Attention is shaped by sleep, stress, interest, and the shape of a task — not willpower alone.' },
  factThreeTitle: { ar: 'لكل شخص إيقاعه', en: 'Everyone has a rhythm' },
  factThreeBody: { ar: 'قد يتغير التركيز والطاقة خلال اليوم، وهذا لا يجعل تجربتك أقل حقيقة.', en: 'Focus and energy can shift across the day. That does not make your experience less real.' },
  factFourTitle: { ar: 'الفهم يفتح الخيارات', en: 'Understanding creates options' },
  factFourBody: { ar: 'عندما نرى النمط بوضوح، يصبح اختيار البيئة والخطوة التالية أسهل.', en: 'When a pattern is visible, choosing your environment and next step becomes easier.' },
  ctaKicker: { ar: 'خطوة واحدة تكفي الآن', en: 'One step is enough for now' },
  ctaTitle: { ar: `اجعل يومك يعمل معك،\nلا ضدك.`, en: `Let your day work with you,\nnot against you.` },
  ctaBody: { ar: 'أنشئ مساحة خاصة تلاحظ فيها نفسك بلا ضغط. AFTA هنا ليستمع، يرتّب، ويترك لك القرار.', en: 'Create a private space to notice yourself without pressure. AFTA listens, helps you organize, and leaves the decision with you.' },
  footerNote: { ar: 'AFTA — فهم أهدأ، خطوة أوضح.', en: 'AFTA — quieter understanding, clearer next steps.' },
  authBack: { ar: 'العودة إلى الصفحة الرئيسية', en: 'Back to home' },
  authWelcome: { ar: 'أهلًا بك في مساحتك الهادئة', en: 'Welcome to your quieter space' },
  authSignInTitle: { ar: 'تسجيل الدخول', en: 'Sign in' },
  authSignUpTitle: { ar: 'أنشئ حسابك', en: 'Create your account' },
  authSignInBody: { ar: 'تابع من النقطة التي تركت عندها نفسك.', en: 'Continue from where you left yourself.' },
  authSignUpBody: { ar: 'ابدأ مساحة خاصة لفهم نمطك يومًا بعد يوم.', en: 'Start a private space for understanding your patterns, one day at a time.' },
  appName: { ar: 'AFTA', en: 'AFTA' },
  signInHeadline: { ar: 'أهلًا بعودتك', en: 'Welcome back' },
  signInSubhead: { ar: 'عد إلى مساحتك الهادئة وتابع من حيث توقفت.', en: 'Return to your quieter space and continue where you left off.' },
  signUpHeadline: { ar: 'ابدأ مساحة تناسبك', en: 'Start a space that fits you' },
  signUpSubhead: { ar: 'افهم نمطك ورتّب يومك بخطوات هادئة.', en: 'Understand your patterns and shape your day in gentle steps.' },
  signInTitle: { ar: 'تسجيل الدخول', en: 'Sign in' },
  signInSubtitle: { ar: 'تابع من النقطة التي توقفت عندها.', en: 'Continue from where you left off.' },
  signUpTitle: { ar: 'أنشئ حسابك', en: 'Create your account' },
  signUpSubtitle: { ar: 'ابدأ مساحة خاصة لفهم نمطك يومًا بعد يوم.', en: 'Start a private space for understanding your patterns.' },
  nameLabel: { ar: 'الاسم', en: 'Name' },
  emailLabel: { ar: 'البريد الإلكتروني', en: 'Email address' },
  passwordLabel: { ar: 'كلمة المرور', en: 'Password' },
  minPassword: { ar: '8 أحرف على الأقل', en: 'At least 8 characters' },
  signInBtn: { ar: 'تسجيل الدخول', en: 'Sign in' },
  signUpBtn: { ar: 'إنشاء الحساب', en: 'Create account' },
  signInLink: { ar: 'سجّل الدخول', en: 'Sign in' },
  signUpLink: { ar: 'أنشئ حسابًا', en: 'Create one' },
  hasAccount: { ar: 'لديك حساب بالفعل؟', en: 'Already have an account?' },
  backToHome: { ar: 'العودة إلى الصفحة الرئيسية', en: 'Back to home' },
  name: { ar: 'الاسم', en: 'Name' },
  email: { ar: 'البريد الإلكتروني', en: 'Email address' },
  password: { ar: 'كلمة المرور', en: 'Password' },
  verificationCode: { ar: 'رمز التحقق', en: 'Verification code' },
  verificationBody: { ar: 'أرسلنا رمزًا إلى بريدك الإلكتروني. اكتبه هنا لإكمال إنشاء الحساب.', en: 'We sent a code to your email. Enter it here to finish creating your account.' },
  continue: { ar: 'متابعة', en: 'Continue' },
  haveAccount: { ar: 'لديك حساب بالفعل؟', en: 'Already have an account?' },
  noAccount: { ar: 'ليس لديك حساب؟', en: 'Do not have an account?' },
  passwordHint: { ar: '8 أحرف على الأقل', en: 'At least 8 characters' },
  emailPlaceholder: { ar: 'name@example.com', en: 'name@example.com' },
  passwordPlaceholder: { ar: '••••••••', en: '••••••••' },
  namePlaceholder: { ar: 'اكتب اسمك', en: 'Your name' },
  codePlaceholder: { ar: '000000', en: '000000' },
  authError: { ar: 'تعذر إكمال الطلب الآن. تحقق من بياناتك وحاول مرة أخرى.', en: 'We could not complete that just now. Check your details and try again.' },
  requiredName: { ar: 'اكتب اسمك لنبدأ.', en: 'Tell us your name to begin.' },
  requiredEmail: { ar: 'أدخل بريدًا إلكترونيًا صحيحًا.', en: 'Enter a valid email address.' },
  requiredPassword: { ar: 'استخدم 8 أحرف على الأقل.', en: 'Use at least 8 characters.' },
  passwordNeedsNumber: { ar: 'يجب أن تحتوي كلمة المرور على رقم واحد على الأقل.', en: 'Password must contain at least one number.' },
  passwordTooWeak: { ar: 'كلمة المرور لا تستوفي متطلبات الأمان. استخدم مزيجًا أقوى من الأحرف والأرقام.', en: 'Password does not meet the security requirements. Use a stronger mix of letters and numbers.' },
  passwordCompromised: { ar: 'ظهرت كلمة المرور هذه في تسريب بيانات سابق. اختر كلمة مرور مختلفة.', en: 'This password has appeared in a previous data breach. Choose a different password.' },
  verificationCodeInvalid: { ar: 'رمز التحقق غير صحيح أو انتهت صلاحيته. تحقق من الرمز وحاول مرة أخرى.', en: 'The verification code is incorrect or expired. Check the code and try again.' },
  captchaError: { ar: 'تعذر إكمال التحقق الأمني. أعد تحميل الصفحة وحاول مرة أخرى.', en: 'The security check could not be completed. Reload the page and try again.' },
  tooManyAttempts: { ar: 'تمت محاولات كثيرة خلال وقت قصير. انتظر قليلًا ثم حاول مرة أخرى.', en: 'Too many attempts were made in a short time. Wait a moment and try again.' },
  wrongCredentials: { ar: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.', en: 'The email or password is not correct.' },
  emailInUse: { ar: 'هذا البريد مستخدم بالفعل. جرّب تسجيل الدخول.', en: 'This email is already in use. Try signing in.' },
  emailRateLimited: { ar: 'أُرسلت رسائل تأكيد كثيرة خلال وقت قصير. انتظر بضع دقائق ثم حاول مرة أخرى.', en: 'Too many confirmation emails were sent in a short time. Wait a few minutes and try again.' },
  emailConfirmed: { ar: 'تم تأكيد بريدك الإلكتروني. سجّل الدخول للمتابعة.', en: 'Your email is confirmed. Sign in to continue.' },
  emailConfirmationRequired: { ar: 'تحقق من بريدك الإلكتروني لتأكيد الحساب، ثم سجّل الدخول.', en: 'Check your email to confirm your account, then sign in.' },
  dashboardSubtitle: { ar: 'خذ نفسًا عميقًا، وفكّك أفكارك، وتابع تقدمك بخطوات هادئة.', en: 'Take a deep breath, untangle your thoughts, and move forward in gentle steps.' },
  signedInTitle: { ar: 'وصلت إلى مساحتك.', en: 'You made it to your space.' },
  signedInBody: { ar: 'نحن نجهّز AFTA ليبدأ معك بهدوء. لا تحتاج إلى فعل أي شيء الآن.', en: 'We are preparing AFTA to begin gently with you. There is nothing else you need to do right now.' },
  signedInBadge: { ar: 'تم تسجيل الدخول', en: 'Signed in' },
  signOut: { ar: 'تسجيل الخروج', en: 'Sign out' },
  signOutError: { ar: 'تعذر تسجيل الخروج الآن. حاول مرة أخرى.', en: 'We could not sign you out just now. Please try again.' },
  backHome: { ar: 'العودة للرئيسية', en: 'Back to home' },
  loading: { ar: 'لحظة واحدة…', en: 'One moment…' },
  notFoundTitle: { ar: 'هذه الصفحة أخذت استراحة.', en: 'This page took a little break.' },
  notFoundBody: { ar: 'لا نجد ما تبحث عنه هنا، لكن يمكنك العودة إلى مساحتك الهادئة.', en: 'We could not find what you are looking for, but you can return to your quieter space.' },
  unavailableTitle: { ar: 'نحتاج إلى مفتاح صغير', en: 'We need one small key' },
  unavailableBody: { ar: 'خدمة تسجيل الدخول غير متاحة الآن. حاول مرة أخرى بعد قليل.', en: 'Sign-in is unavailable right now. Try again shortly.' },
  loadErrorTitle: { ar: 'تعذر تحميل مساحتك الآن', en: 'We could not load your space' },
  loadErrorBody: { ar: 'تحقق من اتصالك وحاول مرة أخرى. سيبقى تقدمك المحفوظ كما هو.', en: 'Check your connection and try again. Your saved progress will stay intact.' },
  retry: { ar: 'حاول مرة أخرى', en: 'Try again' },
  saveError: { ar: 'تعذر حفظ هذه الخطوة. حاول مرة أخرى.', en: 'We could not save this step. Please try again.' },

  intro1: { ar: 'الانتباه ليس شيئاً نملكه أو نفقده، بل هو طاقة تتحرك وتتغير.', en: 'Attention isn’t something we simply have or lose. It is energy that moves and shifts.' },
  intro2: { ar: 'بعض الأيام تكون فيها طاقتنا عالية ومشتتة، وفي أيام أخرى تكون عميقة ومركزة.', en: 'Some days our energy is high and scattered, other days it is deep and focused.' },
  intro3: { ar: 'فهم نمطك لا يعني محاولة إصلاحه، بل تعلم كيف تعمل معه.', en: 'Understanding your pattern isn’t about fixing it, but learning to work with it.' },
  intro4: { ar: 'نحن هنا لنستكشف هذا النمط معاً، بخطوات صغيرة وهادئة.', en: 'We are here to explore this pattern together, with small and gentle steps.' },
  
  chatHello: { ar: 'أهلاً بك. أنا AFTA. أنا هنا لمساعدتك على ترتيب يومك بالطريقة التي تناسبك. لنتعرف على ما يهمك أكثر.', en: 'Hello. I am AFTA. I am here to help you structure your day in a way that works for you. Let’s learn what matters most to you.' },
  chatInterests: { ar: 'ما هي اهتماماتك التي تود أن تجد وقتاً لها؟', en: 'What are the interests you want to find time for?' },
  interestCreative: { ar: 'الإبداع والفنون', en: 'Creativity & Arts' },
  interestWork: { ar: 'العمل والمشاريع', en: 'Work & Projects' },
  interestHealth: { ar: 'الصحة والراحة', en: 'Health & Rest' },
  interestLearning: { ar: 'التعلم والقراءة', en: 'Learning & Reading' },
  
  chatNeeds: { ar: 'وما هي احتياجاتك اليومية التي تشعر أنها تتطلب دعماً أكثر؟', en: 'And what daily needs feel like they require more support?' },
  needFocus: { ar: 'الحفاظ على التركيز', en: 'Maintaining Focus' },
  needStart: { ar: 'البدء بالمهام', en: 'Starting Tasks' },
  needRest: { ar: 'أخذ استراحات فعلية', en: 'Taking Real Breaks' },
  needOrganize: { ar: 'ترتيب الأولويات', en: 'Organizing Priorities' },
  
  chatSupport: { ar: 'أخيراً، كيف تفضل أن أدعمك؟', en: 'Finally, how do you prefer to be supported?' },
  supportGentle: { ar: 'تذكيرات هادئة', en: 'Gentle Reminders' },
  supportStructured: { ar: 'هيكل واضح', en: 'Clear Structure' },
  
  chatFinish: { ar: 'شكراً لمشاركتك. لقد جهزت مساحتك الخاصة لتبدأ رحلتك.', en: 'Thank you for sharing. I’ve prepared your private space to begin your journey.' },
  
  startJourney: { ar: 'ابدأ رحلتك', en: 'Start your journey' },
  comingSoonTitle: { ar: 'مساحتك قيد التجهيز', en: 'Your space is in progress' },
  comingSoonBody: { ar: 'نحن نبني الأدوات التي ستساعدك على فهم وتتبع نمطك. قريباً ستتمكن من رؤية إيقاع يومك هنا.', en: 'We are building the tools to help you understand and track your pattern. Soon you will see your daily rhythm here.' },
  
  dashboardWelcome: { ar: 'أهلًا بك', en: 'Welcome' },
  cardDeclutter: { ar: 'لمّ الشتات', en: 'Gather Your Thoughts' },
  cardDeclutterDescription: { ar: 'لمّ الأفكار المتناثرة وتخفيف الشعور بالضغط.', en: 'Gather scattered thoughts and ease mental overload.' },
  cardOrganize: { ar: 'تفكيك الأفكار', en: 'Untangle Your Thoughts' },
  cardOrganizeDescription: { ar: 'تنظيم الأفكار المعقدة وتحويلها إلى خطوات واضحة.', en: 'Untangle complex thoughts and turn them into clear steps.' },
  dailyQuestionsDescription: { ar: 'تأملات قصيرة لزيادة الوعي والامتنان اليومي.', en: 'Short reflections to build awareness and daily gratitude.' },
  cardComingSoon: { ar: 'قريباً', en: 'Coming soon' },
  dailyReminder: { ar: 'لديك ٣ أسئلة سريعة اليوم.', en: 'You have 3 quick questions today.' },
  dailyAction: { ar: 'البدء', en: 'Start' },
  dailyQuestionsTitle: { ar: 'جلسة وعي', en: 'Awareness Session' },
  q1Label: { ar: 'ما الذي يشغل بالك اليوم؟', en: 'What is on your mind today?' },
  q2Label: { ar: 'كيف تشعر حيال ذلك؟', en: 'How do you feel about it?' },
  q3Label: { ar: 'ما هي الخطوة الصغيرة التالية؟', en: 'What is one small next step?' },
  dailySaved: { ar: 'تم حفظ إجابات اليوم.', en: 'Today’s answers saved.' },
  reflectionFeedback: { ar: 'تأمّل إجاباتي مع أفتا', en: 'Reflect on my answers with AFTA' },
  reflectionThinking: { ar: 'أفتا يتأمّل إجاباتك…', en: 'AFTA is reflecting on your answers…' },
  reflectionError: { ar: 'تعذّر تقديم التأمل الآن. إجاباتك المحفوظة لم تتغير. اضغط للمحاولة مجددًا.', en: 'Reflection is unavailable right now. Your saved answers are unchanged. Press the button to retry.' },
  save: { ar: 'حفظ', en: 'Save' },
  saving: { ar: 'جاري الحفظ...', en: 'Saving...' },
  chatInputPlaceholder: { ar: 'اكتب هنا...', en: 'Type here...' },
  interactiveInputPlaceholder: { ar: 'اكتب إجابتك، ثم اضغط إرسال...', en: 'Type your answer, then tap Send...' },
  send: { ar: 'إرسال', en: 'Send' },
  sending: { ar: 'جاري الإرسال...', en: 'Sending...' },
  stepDone: { ar: 'مكتمل', en: 'Done' },
  stepPending: { ar: 'قيد الانتظار', en: 'Pending' },
  declutterEmpty: { ar: 'اكتب ما يشغل ذهنك الآن، حتى لو كان غير مرتب.', en: 'Write what is taking up space in your mind, even if it feels unorganized.' },
  organizeEmpty: { ar: 'شارك فكرة أو مهمة تريد تحويلها إلى خطوات واضحة.', en: 'Share a thought or task you want to turn into clear steps.' },
  chatLoadError: { ar: 'تعذر تحميل المحادثة. حاول مرة أخرى بعد قليل.', en: 'We could not load this conversation. Please try again shortly.' },
  chatSaveError: { ar: 'تعذر حفظ التغيير. حاول مرة أخرى.', en: 'We could not save that change. Please try again.' },
  chatChooseOption: { ar: 'اختر خيارًا للمتابعة.', en: 'Choose an option to continue.' },
  chatOptionOrText: { ar: 'يمكنك اختيار خيار أو كتابة إجابتك.', en: 'Choose an option or write your own answer.' },
  startNewConversation: { ar: 'ابدأ محادثة جديدة', en: 'Start New Conversation' },
  priorityReason: { ar: 'السبب', en: 'Reason' },
  priorityNextStep: { ar: 'الخطوة التالية', en: 'Next step' },
  chatResponseUnavailable: { ar: 'لا توجد إجابة متاحة الآن. حاول مرة أخرى.', en: 'This response is not available right now. Please try again.' },
  dailySaveError: { ar: 'تعذر حفظ إجابات اليوم. حاول مرة أخرى.', en: 'We could not save today’s answers. Please try again.' },
  dailyLoadError: { ar: 'تعذر تحميل إجابات اليوم. أعد المحاولة قبل كتابة إجابات جديدة.', en: 'We could not load today’s answers. Retry before writing new answers.' },

  next: { ar: 'التالي', en: 'Next' },
  back: { ar: 'رجوع', en: 'Back' },
  finish: { ar: 'إنهاء', en: 'Finish' }
};

type I18nValue = { lang: Language; setLang: (lang: Language) => void; t: (key: string) => string };
const I18nContext = createContext<I18nValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem('mindful-language');
    return saved === 'en' ? 'en' : 'ar';
  });

  const setLang = (next: Language) => {
    setLangState(next);
    localStorage.setItem('mindful-language', next);
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const value = useMemo(() => ({
    lang,
    setLang,
    t: (key: string) => copy[key]?.[lang] ?? key,
  }), [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside LanguageProvider');
  return context;
}

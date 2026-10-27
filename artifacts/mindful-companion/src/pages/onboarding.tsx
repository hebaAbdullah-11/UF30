import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { 
  useGetUserOnboarding, 
  useUpdateUserOnboarding, 
  getGetUserOnboardingQueryKey,
  useSyncUserProfile,
  type UserOnboarding,
  type OnboardingChatAnswers
} from '@workspace/api-client-react';
import { LanguageToggle } from '@/pages/landing';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { ArrowLeft, ArrowRight, LoaderCircle } from 'lucide-react';
import { GentleLoader } from '@/components/gentle-loader';

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const { isLoaded, isSignedIn, user } = useAuth();
  const onboardingQueryKey = [...getGetUserOnboardingQueryKey(), user?.id ?? 'anonymous'] as const;
  const { data: onboarding, isLoading, isError, refetch } = useGetUserOnboarding({
    query: {
      enabled: Boolean(isLoaded && isSignedIn && user?.id),
      queryKey: onboardingQueryKey,
    },
  });
  const { mutate: syncProfile } = useSyncUserProfile();
  const synced = useRef(false);

  useEffect(() => {
    if (isLoaded && !isSignedIn) setLocation('/sign-in');
  }, [isLoaded, isSignedIn, setLocation]);

  useEffect(() => {
    if (user && !synced.current) {
      synced.current = true;
      syncProfile({
        data: {
          name: user.name,
          email: user.email,
        },
      });
    }
  }, [user, syncProfile]);

  useEffect(() => {
    if (onboarding && onboarding.stage === 'complete') {
      setLocation('/dashboard');
    }
  }, [onboarding, setLocation]);

  if (!isLoaded || !isSignedIn || isLoading) {
    return <GentleLoader testId="status-onboarding-loading" />;
  }

  if (isError || !onboarding) {
    return <LoadError onRetry={() => { void refetch(); }} />;
  }

  if (onboarding.stage === 'complete') {
    return null; // Redirecting to dashboard
  }

  return (
    <main className="grain min-h-[100dvh] bg-background">
      <div className="absolute end-5 top-5 sm:end-8 sm:top-8 z-50">
        <LanguageToggle />
      </div>
      
      {onboarding.stage === 'intro' && <IntroSection onboarding={onboarding} queryKey={onboardingQueryKey} />}
      {onboarding.stage === 'chat' && <ChatSection onboarding={onboarding} queryKey={onboardingQueryKey} />}
    </main>
  );
}

function IntroSection({ onboarding, queryKey }: { onboarding: UserOnboarding; queryKey: readonly unknown[] }) {
  const { t, lang } = useI18n();
  const [step, setStep] = useState(onboarding.introStep);
  const [saveError, setSaveError] = useState(false);
  const { mutate: updateOnboarding, isPending } = useUpdateUserOnboarding({
    mutation: { onError: () => setSaveError(true) },
  });
  const queryClient = useQueryClient();
  const pointerStartX = useRef<number | null>(null);
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;
  const ArrowBack = lang === 'ar' ? ArrowRight : ArrowLeft;
  
  const introCards = [
    { id: 0, text: t('intro1') },
    { id: 1, text: t('intro2') },
    { id: 2, text: t('intro3') },
    { id: 3, text: t('intro4') },
  ];

  const handleNext = () => {
    if (isPending) return;
    setSaveError(false);
    const isLast = step === introCards.length - 1;
    const nextStep = isLast ? step : step + 1;
    const nextStage = isLast ? 'chat' : 'intro';
    
    updateOnboarding({ data: { introStep: nextStep, stage: nextStage } }, {
      onSuccess: (data) => {
        queryClient.setQueryData(queryKey, data);
        if (!isLast) setStep(nextStep);
      }
    });
  };

  const handleBack = () => {
    if (step > 0 && !isPending) {
      setSaveError(false);
      const prevStep = step - 1;
      updateOnboarding({ data: { introStep: prevStep } }, {
        onSuccess: (data) => {
          queryClient.setQueryData(queryKey, data);
          setStep(prevStep);
        }
      });
    }
  };

  const handleSwipe = (startX: number, endX: number) => {
    const distance = endX - startX;
    if (Math.abs(distance) < 48) return;

    const isForwardSwipe = lang === 'ar' ? distance > 0 : distance < 0;
    if (isForwardSwipe) handleNext();
    else handleBack();
  };

  return (
    <div
      className="flex min-h-[100dvh] touch-pan-y flex-col items-center justify-center px-6 py-12 soft-reveal"
      key={`intro-${step}`}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) {
          pointerStartX.current = null;
          return;
        }
        pointerStartX.current = event.clientX;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={(event) => {
        if (pointerStartX.current === null) return;
        const startX = pointerStartX.current;
        pointerStartX.current = null;
        handleSwipe(startX, event.clientX);
      }}
      onPointerCancel={() => { pointerStartX.current = null; }}
      data-testid="card-intro-story"
    >
      <div className="mb-12 flex gap-2">
        {introCards.map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-primary' : i < step ? 'w-1.5 bg-primary/55' : 'w-1.5 bg-primary/20'}`} />
        ))}
      </div>
      
      <div className="w-full max-w-md text-center">
        <p className="font-arabic text-2xl font-bold leading-[1.6] text-primary sm:text-3xl" data-testid={`text-intro-${step}`}>
          {introCards[step].text}
        </p>
      </div>

      <div className="mt-16 flex w-full max-w-md items-center justify-between">
        {step > 0 ? (
          <button onClick={handleBack} disabled={isPending} className="flex h-12 w-12 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground disabled:opacity-50" data-testid="button-intro-back">
            <ArrowBack className="h-5 w-5" />
          </button>
        ) : <div className="h-12 w-12" />}
        
        <button onClick={handleNext} disabled={isPending} className="group flex h-14 items-center gap-3 rounded-full bg-primary px-8 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60" data-testid="button-intro-next">
          {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <>{t('next')} <Arrow className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" /></>}
        </button>
      </div>
      <SaveError visible={saveError} />
    </div>
  );
}

function ChatSection({ onboarding, queryKey }: { onboarding: UserOnboarding; queryKey: readonly unknown[] }) {
  const { t, lang } = useI18n();
  const [saveError, setSaveError] = useState(false);
  const { mutate: updateOnboarding, isPending } = useUpdateUserOnboarding({
    mutation: { onError: () => setSaveError(true) },
  });
  const queryClient = useQueryClient();
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;

  const [chatAnswers, setChatAnswers] = useState<OnboardingChatAnswers>(onboarding.chatAnswers || { interests: [], dailyNeeds: [], supportPreference: '' });
  const [currentStep, setCurrentStep] = useState(() => {
    if (onboarding.chatAnswers.supportPreference) return 3;
    if (onboarding.chatAnswers.dailyNeeds.length > 0) return 2;
    if (onboarding.chatAnswers.interests.length > 0) return 1;
    return 0;
  });

  const handleNext = () => {
    if (isPending) return;
    setSaveError(false);
    
    if (currentStep === 3) {
      updateOnboarding({ data: { chatAnswers, stage: 'complete' } }, {
        onSuccess: (data) => {
          queryClient.setQueryData(queryKey, data);
        }
      });
    } else {
      updateOnboarding({ data: { chatAnswers } }, {
        onSuccess: (data) => {
          queryClient.setQueryData(queryKey, data);
          setCurrentStep((step) => step + 1);
        }
      });
    }
  };

  const toggleArrayItem = <T extends string>(arr: T[], item: T) => {
    if (arr.includes(item)) return arr.filter(i => i !== item);
    return [...arr, item];
  };

  const steps = [
    {
      sys: [t('chatHello'), t('chatInterests')],
      options: ['interestCreative', 'interestWork', 'interestHealth', 'interestLearning'],
      multi: true,
      val: chatAnswers.interests,
      setVal: (v: string) => setChatAnswers({ ...chatAnswers, interests: toggleArrayItem(chatAnswers.interests, v as OnboardingChatAnswers['interests'][number]) }),
      ready: chatAnswers.interests.length > 0
    },
    {
      sys: [t('chatNeeds')],
      options: ['needFocus', 'needStart', 'needRest', 'needOrganize'],
      multi: true,
      val: chatAnswers.dailyNeeds,
      setVal: (v: string) => setChatAnswers({ ...chatAnswers, dailyNeeds: toggleArrayItem(chatAnswers.dailyNeeds, v as OnboardingChatAnswers['dailyNeeds'][number]) }),
      ready: chatAnswers.dailyNeeds.length > 0
    },
    {
      sys: [t('chatSupport')],
      options: ['supportGentle', 'supportStructured'],
      multi: false,
      val: chatAnswers.supportPreference,
      setVal: (v: string) => setChatAnswers({ ...chatAnswers, supportPreference: v as OnboardingChatAnswers['supportPreference'] }),
      ready: !!chatAnswers.supportPreference
    },
    {
      sys: [t('chatFinish')],
      options: [],
      multi: false,
      val: '',
      setVal: () => {},
      ready: true
    }
  ];

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col px-5 pb-[calc(140px+env(safe-area-inset-bottom))] pt-24 sm:px-10">
      <div className="flex flex-1 flex-col gap-8">
        {steps.map((step, idx) => {
          if (idx > currentStep) return null;
          
          return (
            <div key={idx} className="flex flex-col gap-6 soft-reveal">
              {step.sys.map((msg, mIdx) => (
                <div key={mIdx} className="flex items-end gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><span className="block h-2 w-2 rounded-full border-[1.5px] border-current" /></div>
                  <div className="max-w-[85%] rounded-2xl rounded-es-none bg-card p-4 px-5 text-sm leading-[1.7] text-card-foreground shadow-sm">
                    {msg}
                  </div>
                </div>
              ))}

              {idx < currentStep && step.options.length > 0 && (
                <div className="flex justify-end ps-11">
                  <div className="max-w-[85%] rounded-2xl rounded-ee-none bg-primary px-5 py-4 text-sm leading-[1.7] text-primary-foreground shadow-sm" data-testid={`text-chat-answer-${idx}`}>
                    {Array.isArray(step.val)
                      ? step.val.map((answer) => t(answer)).join(lang === 'ar' ? '، ' : ', ')
                      : t(step.val as string)}
                  </div>
                </div>
              )}

              {step.options.length > 0 && idx === currentStep && (
                <div className="mt-4 flex flex-wrap gap-3 ps-11">
                  {step.options.map(opt => {
                    const isSelected = step.multi ? (step.val as string[]).includes(opt) : step.val === opt;
                    return (
                      <button
                        key={opt}
                        onClick={() => step.setVal(opt)}
                        className={`rounded-full border px-5 py-2.5 text-sm font-bold transition-all ${isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-transparent text-muted-foreground hover:border-primary/40 hover:bg-card hover:text-foreground'}`}
                        data-testid={`chip-${opt}`}
                      >
                        {t(opt)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="pointer-events-none fixed bottom-0 start-0 end-0 bg-gradient-to-t from-background via-background/95 to-transparent pb-[calc(2rem+env(safe-area-inset-bottom))] pt-20">
        <div className="pointer-events-auto mx-auto flex max-w-2xl justify-end px-5 sm:px-10">
          <div className="flex flex-col items-end gap-3">
            <SaveError visible={saveError} />
            <button onClick={handleNext} disabled={isPending || !steps[currentStep].ready} className="group flex h-14 items-center gap-3 rounded-full bg-primary px-8 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60" data-testid="button-chat-next">
              {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : (currentStep === 3 ? <>{t('startJourney')} <Arrow className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" /></> : <>{t('next')} <Arrow className="h-4 w-4 transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1" /></>)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <main className="grain flex min-h-[100dvh] items-center justify-center bg-background px-5 text-center">
      <div className="absolute end-5 top-5 sm:end-8 sm:top-8"><LanguageToggle /></div>
      <div className="max-w-md rounded-[2rem] border border-border bg-card p-8 shadow-md" role="alert">
        <h1 className="font-arabic text-2xl font-bold text-primary">{t('loadErrorTitle')}</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{t('loadErrorBody')}</p>
        <button type="button" onClick={onRetry} className="mt-7 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground" data-testid="button-onboarding-retry">{t('retry')}</button>
      </div>
    </main>
  );
}

function SaveError({ visible }: { visible: boolean }) {
  const { t } = useI18n();
  if (!visible) return null;
  return <p className="mt-3 text-center text-xs font-bold text-destructive" role="alert" data-testid="text-onboarding-save-error">{t('saveError')}</p>;
}

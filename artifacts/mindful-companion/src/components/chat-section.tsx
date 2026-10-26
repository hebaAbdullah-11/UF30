import { lazy, Suspense, useEffect, useRef, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Plus } from 'lucide-react';
import { ChatMediaComposer } from './chat-media-composer';
import { ChatImage } from './chat-image';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { SectionHeader } from '@/components/section-header';
import { GentleLoader } from '@/components/gentle-loader';
import {
  useGetInternalChat,
  getGetInternalChatQueryKey,
  useSendInternalChatMessage,
  useStartNewInternalChatConversation,
  useUpdateInternalChatStep,
  type InternalChatMessage,
  type AgentResponse
} from '@workspace/api-client-react';

const MermaidFlowchart = lazy(() => import('./mermaid-flowchart'));

export function ChatSection({ section, title, accentTextClass, userBubbleClass, bgAccentClass }: { section: 'declutter' | 'organize_thoughts', title: string, accentTextClass: string, userBubbleClass: string, bgAccentClass: string }) {
  const { t, lang } = useI18n();
  const { isLoaded, isSignedIn, user } = useAuth();
  const queryClient = useQueryClient();
  const [inputValue, setInputValue] = useState('');
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaResetKey, setMediaResetKey] = useState(0);
  const [composerHeight, setComposerHeight] = useState(140);
  const composerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // React mutation state updates on the next render; this guard also covers same-frame submits.
  const sendingRef = useRef(false);
  const retryRef = useRef<{ signature: string; requestId: string } | null>(null);

  useEffect(() => {
    setInputValue('');
    setMediaResetKey((key) => key + 1);
    retryRef.current = null;
  }, [user?.id, section]);
  
  const chatParams = useMemo(() => ({ language: lang }), [lang]);
  const queryKey = useMemo(
    () => [...getGetInternalChatQueryKey(section, chatParams), user?.id ?? 'anonymous'],
    [section, chatParams, user?.id],
  );
  
  const { data: history, isLoading, isError, refetch } = useGetInternalChat(section, chatParams, {
    query: {
      enabled: Boolean(isLoaded && isSignedIn && user?.id),
      queryKey,
    }
  });

  const sendMessage = useSendInternalChatMessage({ mutation: { retry: false } });
  const startNewConversation = useStartNewInternalChatConversation();
  const updateStep = useUpdateInternalChatStep();

  const handleStartNewConversation = () => {
    if (sendingRef.current || mediaBusy || startNewConversation.isPending || section !== 'organize_thoughts') return;
    sendingRef.current = true;
    startNewConversation.mutate(
      { section, data: { language: lang } },
      {
        onSuccess: async () => {
          setInputValue('');
          setMediaResetKey((key) => key + 1);
          retryRef.current = null;
          await queryClient.invalidateQueries({ queryKey });
        },
        onSettled: () => { sendingRef.current = false; },
      },
    );
  };

  useEffect(() => {
    const element = composerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setComposerHeight(Math.ceil(element.getBoundingClientRect().height)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (history) {
      const timer = setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [history, composerHeight]);

  const latestAssistant = useMemo(
    () => history?.slice().reverse().find((message) => message.role === 'assistant'),
    [history],
  );
  const latestResponse = latestAssistant?.response;
  const interactiveFreeText = latestResponse?.type === 'interactive' && latestResponse.allowFreeText;
  const submitTurn = (data: { message?: string; image?: { objectPath: string; contentType: 'image/jpeg' | 'image/png' | 'image/webp' }; option?: { id: string; label: string; value: string }; language: 'ar' | 'en' }) => {
    if (sendingRef.current || sendMessage.isPending || startNewConversation.isPending) return;
    sendingRef.current = true;
    const signature = JSON.stringify([user?.id, section, data]);
    if (retryRef.current?.signature !== signature) {
      retryRef.current = { signature, requestId: crypto.randomUUID() };
    }
    sendMessage.mutate(
      { section, data: { ...data, requestId: retryRef.current.requestId } },
      {
        onSuccess: async (exchange) => {
          retryRef.current = null;
          if (!data.option) {
            setInputValue('');
            setMediaResetKey((key) => key + 1);
          }
          await queryClient.cancelQueries({ queryKey });
          queryClient.setQueryData<InternalChatMessage[]>(queryKey, (previous = []) => {
            const messages = new Map(previous.map((message) => [message.id, message]));
            messages.set(exchange.userMessage.id, exchange.userMessage);
            messages.set(exchange.assistantMessage.id, exchange.assistantMessage);
            return [...messages.values()];
          });
          await queryClient.invalidateQueries({ queryKey });
        },
        onError: () => {
          if (data.message) setInputValue((current) => current || data.message!);
        },
        onSettled: () => { sendingRef.current = false; },
      },
    );
  };
  const sendOption = (option: { id: string; label: string; value: string }) => {
    if (!latestAssistant) return;
    submitTurn({ option, language: lang });
  };

  const handleMediaSend = (image?: { objectPath: string; contentType: string }) => {
    if ((!inputValue.trim() && !image) || sendingRef.current || sendMessage.isPending || startNewConversation.isPending) return;
    submitTurn({ message: inputValue.trim(), ...(image ? { image: { ...image, contentType: image.contentType as 'image/jpeg' | 'image/png' | 'image/webp' } } : {}), language: lang });
  };

  const toggleStep = (messageId: string, order: number, done: boolean) => {
    updateStep.mutate({ section, messageId, order, data: { done: !done } }, {
        onSuccess: () => {
        queryClient.invalidateQueries({ queryKey });
      }
    });
  };

  const renderOptions = (
    options: { id: string; label: string; value: string }[],
    active: boolean,
  ) => (
    <div className="mt-5 grid gap-2 sm:grid-cols-2" role="group">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          disabled={!active || mediaBusy || sendMessage.isPending || startNewConversation.isPending}
          onClick={() => sendOption(option)}
          className="min-h-11 rounded-2xl border border-primary/20 bg-background/70 px-4 py-3 text-start text-sm font-semibold text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45"
          data-testid={`button-${section}-option-${option.id}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  const renderResponse = (message: InternalChatMessage) => {
    const res = message.response;

    if (res.type === 'flowchart') {
      return (
        <div>
          <p className="whitespace-pre-wrap leading-relaxed" dir="auto">{res.message}</p>
          <Suspense fallback={<GentleLoader fullScreen={false} />}>
            <MermaidFlowchart source={res.mermaid} title={res.title} />
          </Suspense>
        </div>
      );
    }
    
    if (res.type === 'text') {
      return (
        <p className="whitespace-pre-wrap leading-relaxed" dir="auto">
          {res.message}
        </p>
      );
    }
    
    if (res.type === 'task_sequence') {
      const firstUndoneOrder = res.steps.find(s => !s.done)?.order;
      
      return (
        <div className="flex flex-col gap-4">
          <p className="whitespace-pre-wrap leading-relaxed" dir="auto">{res.message}</p>
          <div className="flex flex-col gap-3 rtl:pr-2 ltr:pl-2">
            {res.steps.map((step, index) => {
              const isCurrent = step.order === firstUndoneOrder;
              const isLast = index === res.steps.length - 1;
              return (
                <div key={step.order} className="relative flex items-start gap-4">
                  {!isLast && (
                    <div className="absolute bottom-[-16px] start-[15px] top-8 w-[2px] bg-border" />
                  )}
                  <button 
                    type="button"
                    onClick={() => toggleStep(message.id, step.order, step.done)}
                    className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      step.done
                        ? `${bgAccentClass} border-transparent text-primary-foreground`
                        : isCurrent
                          ? `border-current bg-background ${accentTextClass} shadow-sm`
                          : 'border-border bg-background text-muted-foreground'
                    }`}
                    data-testid={`button-step-${message.id}-${step.order}`}
                    title={step.done ? t('stepDone') : t('stepPending')}
                  >
                    {step.done ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <span>{step.order}</span>
                    )}
                  </button>
                  <span dir="auto" className={`text-[15px] font-medium transition-colors ${step.done ? 'text-muted-foreground line-through' : isCurrent ? 'text-foreground' : 'text-foreground/80'}`}>
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    
    if (res.type === 'thought_clusters') {
      return (
        <div className="flex flex-col gap-4">
          <p className="whitespace-pre-wrap leading-relaxed" dir="auto">{res.message}</p>
          <div className="flex flex-col gap-4">
            {res.clusters.map((cluster, idx) => {
              const clusterTone = idx % 3 === 0
                ? 'border-primary/15 bg-primary/5'
                : idx % 3 === 1
                  ? 'border-accent/20 bg-accent/10'
                  : 'border-[hsl(var(--chart-4))]/20 bg-[hsl(var(--chart-4))]/10';
              const tagTone = idx % 3 === 0
                ? 'border-primary/15 bg-primary/10'
                : idx % 3 === 1
                  ? 'border-accent/20 bg-accent/15'
                  : 'border-[hsl(var(--chart-4))]/20 bg-[hsl(var(--chart-4))]/15';
              return (
              <div key={`${cluster.label}-${idx}`} className={`flex flex-col gap-2 rounded-2xl border p-4 ${clusterTone}`}>
                <span dir="auto" className={`font-arabic text-sm font-bold ${accentTextClass}`}>{cluster.label}</span>
                <div className="flex flex-wrap gap-2">
                  {cluster.items.map((item, itemIdx) => (
                    <span dir="auto" key={`${item}-${itemIdx}`} className={`rounded-full border px-3 py-1 text-sm font-medium text-foreground ${tagTone}`}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )})}
          </div>
        </div>
      );
    }

    if (res.type === 'interactive') {
      return (
        <div>
          <p className="whitespace-pre-wrap leading-relaxed" dir="auto">{res.message}</p>
          {renderOptions(res.options, message.id === latestAssistant?.id)}
          {res.allowFreeText && res.options.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground" dir="auto">{t('chatOptionOrText')}</p>
          )}
        </div>
      );
    }

    if (res.type === 'priority_list') {
      return (
        <div>
          <p className="whitespace-pre-wrap leading-relaxed" dir="auto">{res.message}</p>
          <div className="mt-5 flex flex-col gap-3">
            {res.items.map((item) => (
              <article
                key={`${message.id}-${item.priority}`}
                className="rounded-2xl border border-primary/15 bg-primary/5 p-4"
                data-testid={`card-priority-${item.priority}`}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {item.priority}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-foreground" dir="auto">{item.task}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground" dir="auto">
                      <span className="font-semibold text-foreground">{t('priorityReason')}: </span>{item.reason}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground" dir="auto">
                      <span className="font-semibold text-foreground">{t('priorityNextStep')}: </span>{item.nextStep}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {renderOptions(res.options, message.id === latestAssistant?.id)}
        </div>
      );
    }

    return (
      <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground" dir="auto">
        {t('chatResponseUnavailable')}
      </p>
    );
  };

  return (
    <main className="grain flex min-h-[100dvh] flex-col bg-background">
      <SectionHeader
        title={title}
        colorClass={accentTextClass}
        belowLanguage={section === 'organize_thoughts' ? (
          <button
            type="button"
            onClick={handleStartNewConversation}
            disabled={mediaBusy || sendMessage.isPending || startNewConversation.isPending}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-primary/20 bg-card px-3.5 py-2 text-xs font-bold text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
            data-testid="button-organize_thoughts-new-conversation"
          >
            <Plus className="h-4 w-4" />
            {t('startNewConversation')}
          </button>
        ) : undefined}
      />
      
      <div className="flex flex-1 flex-col mx-auto w-full max-w-2xl px-5 sm:px-8" style={{ paddingBottom: composerHeight + 24 }}>
        {isLoading ? (
          <GentleLoader fullScreen={false} testId={`status-${section}-loading`} />
        ) : isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
            <p className="max-w-sm text-sm leading-7 text-muted-foreground" role="alert" data-testid={`status-${section}-error`}>
              {t('chatLoadError')}
            </p>
            <button type="button" onClick={() => { void refetch(); }} className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground" data-testid={`button-${section}-retry`}>
              {t('retry')}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6 py-6" data-testid={`list-${section}-history`}>
            {history?.length === 0 && (
              <p className="mx-auto max-w-sm py-16 text-center text-sm leading-7 text-muted-foreground" data-testid={`text-${section}-empty`}>
                {section === 'declutter' ? t('declutterEmpty') : t('organizeEmpty')}
              </p>
            )}
            {history?.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`relative max-w-[85%] rounded-[2rem] px-5 py-4 shadow-sm ${
                    msg.role === 'user' 
                      ? userBubbleClass 
                      : 'bg-card border border-border text-card-foreground'
                  } soft-reveal`}
                >
                  {msg.role === 'user' ? (
                    <div>
                      <p className="whitespace-pre-wrap leading-relaxed" dir="auto">{msg.response.message}</p>
                      {msg.response.type === 'text' && msg.response.image && <ChatImage objectPath={msg.response.image.objectPath} />}
                    </div>
                  ) : (
                    renderResponse(msg)
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} style={{ scrollMarginBottom: composerHeight + 24 }} />
          </div>
        )}
      </div>

       <div ref={composerRef} className="fixed bottom-0 start-0 end-0 z-10 bg-gradient-to-t from-background via-background/95 to-transparent pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-10">
        <div className="mx-auto w-full max-w-2xl px-5 sm:px-8">
          <ChatMediaComposer
            value={inputValue}
            onChange={setInputValue}
            onSend={handleMediaSend}
            disabled={!isSignedIn || startNewConversation.isPending}
            isSending={sendMessage.isPending}
            placeholder={interactiveFreeText ? t('interactiveInputPlaceholder') : t('chatInputPlaceholder')}
            section={section}
            userBubbleClass={userBubbleClass}
            interactiveFreeText={Boolean(interactiveFreeText)}
            resetKey={mediaResetKey}
            onBusyChange={setMediaBusy}
          />
          {(sendMessage.isError || updateStep.isError || startNewConversation.isError) && (
            <p className="mt-2 text-center text-xs text-destructive" role="alert" data-testid={`status-${section}-mutation-error`}>
              {t('chatSaveError')}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

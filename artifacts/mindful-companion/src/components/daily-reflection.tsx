import { useReflectOnDailyAnswers } from '@workspace/api-client-react';
import { useI18n } from '@/lib/i18n';

/** Feedback is opt-in and ephemeral; saved journal entries are never modified. */
export function DailyReflection({ answers }: { answers: { q1: string; q2: string; q3: string } }) {
  const { t, lang } = useI18n();
  const reflection = useReflectOnDailyAnswers();
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-6" aria-label={t('reflectionFeedback')}>
      <button
        type="button"
        disabled={reflection.isPending}
        onClick={() => reflection.mutate({ data: { ...answers, language: lang } })}
        className="w-full rounded-full border border-accent/30 bg-accent/10 px-5 py-3 text-accent font-bold disabled:opacity-50"
        data-testid="button-request-reflection"
      >
        {reflection.isPending ? t('reflectionThinking') : t('reflectionFeedback')}
      </button>
      <div aria-live="polite" aria-busy={reflection.isPending}>
        {reflection.isPending ? (
          <p className="text-sm text-muted-foreground">{t('reflectionThinking')}</p>
        ) : reflection.isError ? (
          <p role="alert" className="text-sm text-destructive">{t('reflectionError')}</p>
        ) : reflection.data ? (
          <p className="whitespace-pre-wrap rounded-2xl border border-accent/20 bg-card p-5 text-[15px] leading-8" data-testid="response-daily-reflection">
            {reflection.data.message}
          </p>
        ) : null}
      </div>
    </section>
  );
}

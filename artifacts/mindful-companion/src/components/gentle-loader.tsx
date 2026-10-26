import { useI18n } from '@/lib/i18n';

export function GentleLoader({ testId, fullScreen = true }: { testId?: string; fullScreen?: boolean }) {
  const { t } = useI18n();
  return (
    <div
      className={`flex flex-col items-center justify-center gap-6 bg-background p-5 text-center ${fullScreen ? 'min-h-[100dvh]' : 'min-h-48 flex-1'}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex gap-2.5">
        <div className="h-2 w-2 animate-pulse rounded-full bg-primary/30 delay-75" />
        <div className="h-2 w-2 animate-pulse rounded-full bg-primary/60 delay-150" />
        <div className="h-2 w-2 animate-pulse rounded-full bg-primary/90 delay-300" />
      </div>
      <p className="text-sm font-medium text-muted-foreground animate-pulse" data-testid={testId}>
        {t('loading')}
      </p>
    </div>
  );
}

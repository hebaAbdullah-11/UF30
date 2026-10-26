import { useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { 
  useGetDailyQuestionAnswers, 
  getGetDailyQuestionAnswersQueryKey, 
  useSaveDailyQuestionAnswers 
} from '@workspace/api-client-react';
import { SectionHeader } from '@/components/section-header';
import { useLocalDate } from '@/lib/local-date';
import { GentleLoader } from '@/components/gentle-loader';
import { DailyReflection } from '@/components/daily-reflection';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const formSchema = z.object({
  q1: z.string().min(1).max(200),
  q2: z.string().min(1).max(200),
  q3: z.string().min(1).max(200),
});

export default function DailyQuestions() {
  const { t, lang } = useI18n();
  const [, setLocation] = useLocation();
  const { isLoaded, isSignedIn, user } = useAuth();
  const queryClient = useQueryClient();
  const localDate = useLocalDate();

  const queryKey = useMemo(() => [...getGetDailyQuestionAnswersQueryKey(localDate), user?.id ?? 'anonymous'], [localDate, user?.id]);
  
  const { data: status, isLoading, isError, refetch } = useGetDailyQuestionAnswers(localDate, {
    query: {
      enabled: Boolean(isLoaded && isSignedIn && user?.id),
      queryKey,
    }
  });

  const saveMutation = useSaveDailyQuestionAnswers();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { q1: '', q2: '', q3: '' },
  });

  useEffect(() => {
    if (isLoaded && !isSignedIn) setLocation('/sign-in');
  }, [isLoaded, isSignedIn, setLocation]);

  useEffect(() => {
    if (status?.answers) {
      form.reset({
        q1: status.answers.q1,
        q2: status.answers.q2,
        q3: status.answers.q3,
      });
    } else if (status) form.reset({ q1: '', q2: '', q3: '' });
  }, [status, form]);

  if (!isLoaded || !isSignedIn) return <GentleLoader testId="status-daily-auth-loading" />;

  const isSaved = !!status?.answers;

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    saveMutation.mutate({ date: localDate, data: values }, {
      onSuccess: (data) => {
        queryClient.setQueryData(queryKey, {
          date: localDate,
          answers: data,
        });
      }
    });
  };

  return (
    <main className="grain flex min-h-[100dvh] flex-col bg-background pb-24">
      <SectionHeader title={t('dailyQuestionsTitle')} colorClass="text-accent" />
      
      <div className="flex flex-1 flex-col mx-auto w-full max-w-xl px-5 py-8 sm:px-8">
        {isLoading ? (
          <GentleLoader fullScreen={false} testId="status-daily-questions-loading" />
        ) : isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center" role="alert" data-testid="status-daily-load-error">
            <p className="max-w-sm text-sm leading-7 text-muted-foreground">{t('dailyLoadError')}</p>
            <button type="button" onClick={() => { void refetch(); }} className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground" data-testid="button-daily-retry">
              {t('retry')}
            </button>
          </div>
        ) : status ? (
          <div className="flex flex-col gap-8 soft-reveal">
            {isSaved && (
              <div className="flex items-center gap-3 rounded-[1.5rem] bg-accent/10 px-5 py-4 text-accent border border-accent/20">
                <Check className="h-5 w-5 shrink-0" />
                <p className="font-arabic font-bold">{t('dailySaved')}</p>
              </div>
            )}
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-8">
                <FormField
                  control={form.control}
                  name="q1"
                  render={({ field }) => (
                    <FormItem className="space-y-4">
                      <FormLabel className="font-arabic text-lg font-bold text-foreground">
                        {t('q1Label')}
                      </FormLabel>
                      <FormControl>
                        <textarea
                          placeholder={t('chatInputPlaceholder')}
                          className="min-h-[100px] w-full resize-none rounded-2xl bg-card border border-border p-4 text-[15px] outline-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-accent focus:border-transparent transition-all shadow-sm"
                          {...field}
                          disabled={saveMutation.isPending || isSaved}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="q2"
                  render={({ field }) => (
                    <FormItem className="space-y-4">
                      <FormLabel className="font-arabic text-lg font-bold text-foreground">
                        {t('q2Label')}
                      </FormLabel>
                      <FormControl>
                        <textarea
                          placeholder={t('chatInputPlaceholder')}
                          className="min-h-[100px] w-full resize-none rounded-2xl bg-card border border-border p-4 text-[15px] outline-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-accent focus:border-transparent transition-all shadow-sm"
                          {...field}
                          disabled={saveMutation.isPending || isSaved}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="q3"
                  render={({ field }) => (
                    <FormItem className="space-y-4">
                      <FormLabel className="font-arabic text-lg font-bold text-foreground">
                        {t('q3Label')}
                      </FormLabel>
                      <FormControl>
                        <textarea
                          placeholder={t('chatInputPlaceholder')}
                          className="min-h-[100px] w-full resize-none rounded-2xl bg-card border border-border p-4 text-[15px] outline-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-accent focus:border-transparent transition-all shadow-sm"
                          {...field}
                          disabled={saveMutation.isPending || isSaved}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {!isSaved && (
                  <button
                    type="submit"
                    disabled={saveMutation.isPending || !form.formState.isDirty}
                    className="mt-4 w-full rounded-full bg-accent py-3.5 font-arabic text-[15px] font-bold text-accent-foreground transition-all hover:scale-[1.02] hover:shadow-md hover:shadow-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none"
                    data-testid="button-save-daily"
                  >
                    {saveMutation.isPending ? t('saving') : t('save')}
                  </button>
                )}
                {saveMutation.isError && (
                  <p className="text-center text-sm text-destructive" role="alert" data-testid="status-daily-save-error">
                    {t('dailySaveError')}
                  </p>
                )}
              </form>
            </Form>
            {status.answers && (
              <DailyReflection
                key={`${user?.id}:${localDate}:${lang}`}
                answers={status.answers}
              />
            )}
          </div>
        ) : null}
      </div>
    </main>
  );
}

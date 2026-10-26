import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { ChatSection } from '@/components/chat-section';
import { DailyLink } from '@/components/daily-link';
import { GentleLoader } from '@/components/gentle-loader';

export default function OrganizeThoughts() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (isLoaded && !isSignedIn) setLocation('/sign-in');
  }, [isLoaded, isSignedIn, setLocation]);

  if (!isLoaded || !isSignedIn) return <GentleLoader testId="status-organize-auth-loading" />;

  return (
    <>
    <DailyLink />
    <ChatSection 
      section="organize_thoughts" 
      title={t('cardOrganize')} 
      accentTextClass="text-[hsl(var(--chart-4))]"
      bgAccentClass="bg-[hsl(var(--chart-4))]"
      userBubbleClass="bg-[hsl(var(--chart-4))] text-primary-foreground"
    />
    </>
  );
}

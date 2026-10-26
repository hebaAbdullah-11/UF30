import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { ChatSection } from '@/components/chat-section';
import { DailyLink } from '@/components/daily-link';
import { GentleLoader } from '@/components/gentle-loader';

export default function Declutter() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (isLoaded && !isSignedIn) setLocation('/sign-in');
  }, [isLoaded, isSignedIn, setLocation]);

  if (!isLoaded || !isSignedIn) return <GentleLoader testId="status-declutter-auth-loading" />;

  return (
    <>
    <DailyLink />
    <ChatSection 
      section="declutter" 
      title={t('cardDeclutter')} 
      accentTextClass="text-primary"
      bgAccentClass="bg-primary"
      userBubbleClass="bg-primary text-primary-foreground"
    />
    </>
  );
}

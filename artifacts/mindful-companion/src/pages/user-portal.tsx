import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { getGetUserOnboardingQueryKey, useGetUserOnboarding } from '@workspace/api-client-react';
import { useAuth } from '@/lib/auth';
import { GentleLoader } from '@/components/gentle-loader';

export default function UserPortal() {
  const [, setLocation] = useLocation();
  const { isLoaded, isSignedIn, user } = useAuth();
  const onboardingQueryKey = [...getGetUserOnboardingQueryKey(), user?.id ?? 'anonymous'] as const;
  const { data: onboarding, isError } = useGetUserOnboarding({
    query: {
      enabled: Boolean(isLoaded && isSignedIn && user?.id),
      queryKey: onboardingQueryKey,
    },
  });

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setLocation('/sign-in');
    }
  }, [isLoaded, isSignedIn, setLocation]);

  useEffect(() => {
    if (isError) {
      setLocation('/onboarding');
      return;
    }
    if (onboarding) {
      if (onboarding.stage === 'complete') {
        setLocation('/dashboard');
      } else {
        setLocation('/onboarding');
      }
    }
  }, [isError, onboarding, setLocation]);

  return <GentleLoader testId="status-portal-loading" />;
}

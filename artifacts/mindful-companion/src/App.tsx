import { useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { GentleLoader } from '@/components/gentle-loader';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider, useAuth } from '@/lib/auth';
import { LanguageProvider } from '@/lib/i18n';
import Landing from '@/pages/landing';
import UF30Landing from '@/pages/uf30-landing';
import UF30Register from '@/pages/uf30-register';
import UF30Workspace from '@/pages/uf30-workspace';
import UF30Afta from '@/pages/uf30-afta';
import UF30Organization from '@/pages/uf30-organization';
import UF30OrganizationReports from '@/pages/uf30-organization-reports';
import { SuiteNav } from '@/components/suite-nav';
import { SignInPage, SignUpPage } from '@/pages/auth';
import UserPortal from '@/pages/user-portal';
import Dashboard from '@/pages/dashboard';
import Onboarding from '@/pages/onboarding';
import Declutter from '@/pages/declutter';
import OrganizeThoughts from '@/pages/organize-thoughts';
import DailyQuestions from '@/pages/daily-questions';
import Daily from '@/pages/daily';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function AuthRedirector() {
  const { loading, user } = useAuth();
  const [location, setLocation] = useLocation();
  useEffect(() => {
    if (
      !loading &&
      user &&
      (location.startsWith('/sign-in') ||
        location.startsWith('/sign-up'))
    ) {
      setLocation('/dashboard');
    }
  }, [loading, user, location, setLocation]);
  return null;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      setLocation('/sign-in');
    }
  }, [loading, user, setLocation]);

  if (loading || !user) {
    return <GentleLoader />;
  }

  return children;
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/user-portal">
          <ProtectedRoute><UserPortal /></ProtectedRoute>
        </Route>
        <Route path="/dashboard">
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        </Route>
        <Route path="/app">
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        </Route>
        <Route path="/declutter">
          <ProtectedRoute><Declutter /></ProtectedRoute>
        </Route>
        <Route path="/organize-thoughts">
          <ProtectedRoute><OrganizeThoughts /></ProtectedRoute>
        </Route>
        <Route path="/daily-questions">
          <ProtectedRoute><DailyQuestions /></ProtectedRoute>
        </Route>
        <Route path="/daily">
          <ProtectedRoute><Daily /></ProtectedRoute>
        </Route>
        <Route path="/onboarding">
          <ProtectedRoute><Onboarding /></ProtectedRoute>
        </Route>
        <Route path="/uf30/register" component={UF30Register} />
        <Route path="/uf30/organization" component={UF30Organization} />
        <Route path="/uf30/organization/reports">
          <ProtectedRoute><UF30OrganizationReports /></ProtectedRoute>
        </Route>
        <Route path="/uf30/afta" component={UF30Afta} />
        <Route path="/uf30/focus"><UF30Workspace page="focus" /></Route>
        <Route path="/uf30/discover"><UF30Workspace page="discover" /></Route>
        <Route path="/uf30/me"><UF30Workspace page="me" /></Route>
        <Route path="/afta" component={Landing} />
        <Route path="/" component={UF30Landing} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function AppContent() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AuthRedirector />
        <SuiteNav />
        <Router />
      </AuthProvider>
    </LanguageProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <AppContent />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

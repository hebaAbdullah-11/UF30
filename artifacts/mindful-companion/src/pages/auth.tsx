import { useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Leaf,
  LoaderCircle,
  Mail,
  UserRound
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { LanguageToggle } from "@/pages/landing";
import { AuthRequestError, useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AuthShell({
  children,
  isSignUp,
}: {
  children: ReactNode;
  isSignUp: boolean;
}) {
  const { t, lang } = useI18n();
  const Arrow = lang === "ar" ? ArrowLeft : ArrowRight;

  return (
    <main className="grain min-h-[100dvh] bg-background">
      <div className="mx-auto grid min-h-[100dvh] max-w-7xl lg:grid-cols-[.82fr_1.18fr]">
        <aside className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -bottom-28 -start-20 h-80 w-80 rounded-full border border-accent/20">
            <div className="absolute inset-12 rounded-full border border-accent/20" />
          </div>
          <div className="relative">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-background/10 px-4 py-2 text-sm font-medium text-primary-foreground backdrop-blur-md transition-colors hover:bg-background/20"
            >
              <Leaf className="h-4 w-4 text-accent" />
              <span>AFTA</span>
            </Link>
          </div>
          <div className="relative z-10 space-y-4">
            <p className="text-xs uppercase tracking-[0.25em] text-accent font-semibold">
              {t("brand")}
            </p>
            <h1 className="font-serif text-4xl font-bold tracking-tight xl:text-5xl">
              {isSignUp ? t("authSignUpTitle") : t("authSignInTitle")}
            </h1>
            <p className="text-base text-primary-foreground/80 font-normal">
              {isSignUp ? t("authSignUpBody") : t("authSignInBody")}
            </p>
          </div>
          <div className="relative z-10 text-xs text-primary-foreground/60">
            © {new Date().getFullYear()} AFTA. All rights reserved.
          </div>
        </aside>

        <section className="flex flex-col justify-between p-6 sm:p-10 lg:p-12">
          <header className="flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-serif text-xl font-bold tracking-tight text-primary lg:hidden"
            >
              <Leaf className="h-5 w-5 text-accent" />
              <span>AFTA</span>
            </Link>
            <div className="ms-auto flex items-center gap-3">
              <LanguageToggle />
            </div>
          </header>

          <div className="mx-auto my-auto w-full max-w-md space-y-8 py-8">
            {children}
          </div>

          <footer className="text-center text-xs text-muted-foreground">
            <Link
              href="/"
              className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
            >
              <span>{t("authBack")}</span>
              <Arrow className="h-3 w-3" />
            </Link>
          </footer>
        </section>
      </div>
    </main>
  );
}

function friendlyError(error: unknown, t: (key: string) => string) {
  if (error instanceof AuthRequestError) {
    if (error.code === "NAME_REQUIRED") return t("requiredName");
    if (error.code === "EMAIL_INVALID") return t("requiredEmail");
    if (error.code === "PASSWORD_TOO_SHORT") return t("requiredPassword");
    if (error.code === "EMAIL_IN_USE") return t("emailInUse");
    if (error.code === "INVALID_CREDENTIALS") return t("wrongCredentials");
    if (error.code === "EMAIL_RATE_LIMITED") return t("emailRateLimited");
    if (error.code === "EMAIL_CONFIRMATION_REQUIRED") {
      return t("emailConfirmationRequired");
    }
    return t("authError");
  }
  return t("authError");
}

export function SignInPage() {
  const [, setLocation] = useLocation();
  const { signIn } = useAuth();
  const { t } = useI18n();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // The email confirmation link returns here with ?confirmed=1.
  const [confirmed] = useState(() => new URLSearchParams(window.location.search).has("confirmed"));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !emailPattern.test(email)) {
      setError(t("requiredEmail"));
      return;
    }
    if (!password) {
      setError(t("requiredPassword"));
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      setLocation("/dashboard");
    } catch (err) {
      setError(friendlyError(err, t));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell isSignUp={false}>
      <div className="space-y-2 text-center sm:text-start">
        <h2 className="font-serif text-3xl font-bold tracking-tight text-foreground">
          {t("authSignInTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("authSignInBody")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {confirmed && !error && (
          <div role="status" className="rounded-2xl border border-primary/20 bg-primary/10 p-4 text-xs font-medium text-primary" data-testid="status-email-confirmed">
            {t("emailConfirmed")}
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-xs font-medium text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">
            {t("email")}
          </label>
          <div className="relative">
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-2xl border border-input bg-background/50 px-4 py-3 pe-10 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Mail className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">
            {t("password")}
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-2xl border border-input bg-background/50 px-4 py-3 pe-10 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            t("signIn")
          )}
        </button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        {t("noAccount")}{" "}
        <Link
          href="/sign-up"
          className="font-semibold text-primary underline underline-offset-4 hover:text-primary/80"
        >
          {t("createAccount")}
        </Link>
      </p>
    </AuthShell>
  );
}

export function SignUpPage() {
  const [, setLocation] = useLocation();
  const { signUp } = useAuth();
  const { t } = useI18n();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(t("requiredName"));
      return;
    }
    if (!email || !emailPattern.test(email)) {
      setError(t("requiredEmail"));
      return;
    }
    if (!password || password.length < 8) {
      setError(t("requiredPassword"));
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, name.trim());
      setLocation("/dashboard");
    } catch (err) {
      setError(friendlyError(err, t));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell isSignUp={true}>
      <div className="space-y-2 text-center sm:text-start">
        <h2 className="font-serif text-3xl font-bold tracking-tight text-foreground">
          {t("authSignUpTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("authSignUpBody")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-xs font-medium text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">
            {t("name")}
          </label>
          <div className="relative">
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-2xl border border-input bg-background/50 px-4 py-3 pe-10 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <UserRound className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground">
            {t("email")}
          </label>
          <div className="relative">
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-2xl border border-input bg-background/50 px-4 py-3 pe-10 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Mail className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-foreground">
              {t("password")}
            </label>
            <span className="text-[10px] text-muted-foreground">
              {t("passwordHint")}
            </span>
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-2xl border border-input bg-background/50 px-4 py-3 pe-10 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            t("createAccount")
          )}
        </button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        {t("haveAccount")}{" "}
        <Link
          href="/sign-in"
          className="font-semibold text-primary underline underline-offset-4 hover:text-primary/80"
        >
          {t("signIn")}
        </Link>
      </p>
    </AuthShell>
  );
}

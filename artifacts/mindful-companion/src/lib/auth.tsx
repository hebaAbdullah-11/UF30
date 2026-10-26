import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type LocalUser = {
  id: string;
  name: string;
  email: string;
};

export class AuthRequestError extends Error {
  code: string;

  constructor(code: string, message?: string) {
    super(message || code);
    this.code = code;
    this.name = "AuthRequestError";
  }
}

type AuthContextType = {
  user: LocalUser | null;
  loading: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

function authUrl(path: string) {
  return `/api/auth/${path}`;
}

async function request(path: string, init?: RequestInit): Promise<LocalUser | null> {
  let response: Response;
  try {
    response = await fetch(authUrl(path), {
      ...init,
      credentials: "include",
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new AuthRequestError("REQUEST_FAILED");
  }

  if (!response.ok) {
    let payload: { code?: string; error?: string } = {};
    try {
      payload = await response.json();
    } catch {
      // Keep the status-based error when the server did not return JSON.
    }
    throw new AuthRequestError(
      payload.code || `AUTH_REQUEST_${response.status}`,
      payload.error,
    );
  }

  if (response.status === 204) return null;
  const payload = (await response.json()) as { user?: LocalUser | null };
  return payload.user ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    request("me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function signIn(email: string, pass: string) {
    const nextUser = await request("sign-in", {
      method: "POST",
      body: JSON.stringify({ email, password: pass }),
    });
    setUser(nextUser);
  }

  async function signUp(email: string, pass: string, name: string) {
    const nextUser = await request("sign-up", {
      method: "POST",
      body: JSON.stringify({ email, password: pass, name }),
    });
    setUser(nextUser);
  }

  async function signOut() {
    await request("sign-out", { method: "POST" });
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isLoaded: !loading,
        isSignedIn: Boolean(user),
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
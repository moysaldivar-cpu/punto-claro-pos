import { createContext, useContext, useState, useEffect } from "react";
import { logoutPosAuth } from "@/lib/posAuth";

type PosUser = {
  id: string;
  nombre: string;
  rol: "admin" | "gerente" | "cajero";
  store_id: string | null;

  // Compatibilidad con codigo viejo
  role?: string;
  email?: string;
};

type ContextType = {
  user: PosUser | null;
  loading: boolean;
  logout: () => Promise<void>;

  // Para que no truene codigo viejo
  signOut?: () => Promise<void>;
};

const PosAuthContext = createContext<ContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  signOut: async () => {},
});

export function PosAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PosUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem("pos_user");

    if (raw) {
      try {
        const parsed = JSON.parse(raw);

        setUser({
          ...parsed,
          role: parsed.rol,
        });
      } catch {
        localStorage.removeItem("pos_user");
        localStorage.removeItem("store_id");
      }
    }

    setLoading(false);
  }, []);

  async function logout() {
    try {
      await logoutPosAuth();
    } finally {
      setUser(null);
      window.location.href = "/login";
    }
  }

  async function signOut() {
    await logout();
  }

  return (
    <PosAuthContext.Provider
      value={{
        user,
        loading,
        logout,
        signOut,
      }}
    >
      {children}
    </PosAuthContext.Provider>
  );
}

export function usePosAuth() {
  return useContext(PosAuthContext);
}

// ADAPTADORES PARA QUE TODO LO VIEJO SIGA FUNCIONANDO
export const AuthProvider = PosAuthProvider;
export const useAuth = usePosAuth;

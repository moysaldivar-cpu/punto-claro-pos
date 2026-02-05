import { createContext, useContext, useState, useEffect } from "react";

type PosUser = {
  id: string;
  nombre: string;
  rol: "admin" | "gerente" | "cajero";
  store_id: string | null;

  // 👇 Compatibilidad con código viejo
  role?: string;
  email?: string;
};

type ContextType = {
  user: PosUser | null;
  loading: boolean;
  logout: () => void;

  // 👇 Para que no truene código viejo
  signOut?: () => void;
};

const PosAuthContext = createContext<ContextType>({
  user: null,
  loading: true,
  logout: () => {},
  signOut: () => {},
});

export function PosAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PosUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem("pos_user");

    if (raw) {
      const parsed = JSON.parse(raw);

      // 👇 Doble compatibilidad rol ↔ role
      setUser({
        ...parsed,
        role: parsed.rol,
      });
    }

    setLoading(false);
  }, []);

  function logout() {
    localStorage.removeItem("pos_user");
    setUser(null);
    window.location.href = "/login";
  }

  // 👇 Adaptador para código antiguo
  function signOut() {
    logout();
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

// 🔁 ADAPTADORES PARA QUE TODO LO VIEJO SIGA FUNCIONANDO
export const AuthProvider = PosAuthProvider;
export const useAuth = usePosAuth;

// src/contexts/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";

export type Role = "admin" | "gerente" | "cajero";

type AuthContextType = {
  user: any;
  session: any;
  loading: boolean;

  role: Role | null;
  loadingRole: boolean;

  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [role, setRole] = useState<Role | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  // 🔐 Sesión
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // 🔑 Rol
  useEffect(() => {
    if (!user) {
      console.log("ℹ️ No hay usuario, limpiando rol");
      setRole(null);
      setLoadingRole(false);
      return;
    }

    console.log("🟡 Usuario detectado, cargando rol:", user.id);
    loadUserRole(user.id);
  }, [user]);

  async function loadUserRole(userId: string) {
    setLoadingRole(true);

    console.log("🟡 Consultando profiles por user_id:", userId);

    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", userId)
      .single();

    console.log("🟢 Respuesta profiles:", { data, error });

    if (error) {
      console.error("🔴 Error cargando rol:", error);
      setRole(null);
      setLoadingRole(false);
      return;
    }

    console.log("✅ Rol asignado:", data.role);
    setRole(data.role as Role);
    setLoadingRole(false);
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        role,
        loadingRole,
        signIn,
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
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return ctx;
}

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

export type Role = "admin" | "gerente" | "cajero";

type AuthContextType = {
  user: { email: string } | null;
  role: Role | null;
  loading: boolean;
  loadingRole: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: { email: "local" },
  role: "admin",
  loading: false,
  loadingRole: false,
  signOut: async () => {
    localStorage.removeItem("pc_user");
    window.location.href = "/login";
  },
});

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider
      value={{
        user: { email: localStorage.getItem("pc_user") || "local" },
        role: (localStorage.getItem("pc_role") as Role) || "admin",
        loading: false,
        loadingRole: false,
        signOut: async () => {
          localStorage.removeItem("pc_user");
          localStorage.removeItem("pc_role");
          window.location.href = "/login";
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

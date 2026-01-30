// src/lib/useRole.ts
import { useEffect, useState } from 'react';
import type { Role } from './roles';
import { supabase } from './supabase';

export function useRole(userId: string | null) {
  const [role, setRole] = useState<Role>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    if (!userId) {
      setRole(null);
      setLoadingRole(false);
      return;
    }

    const fetchRole = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (!error) {
        setRole(data?.role ?? null);
      }

      setLoadingRole(false);
    };

    fetchRole();
  }, [userId]);

  return { role, loadingRole };
}

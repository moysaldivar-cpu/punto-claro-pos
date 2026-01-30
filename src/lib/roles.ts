// src/lib/roles.ts

export type Role = 'admin' | 'cajero' | 'gerente' | null;

export function isAdmin(role: Role) {
  return role === 'admin';
}

export function isCajero(role: Role) {
  return role === 'cajero';
}

export function isGerente(role: Role) {
  return role === 'gerente';
}

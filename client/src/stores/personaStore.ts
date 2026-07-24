import { create } from 'zustand';
import { personaApi } from '../services/api';
import type { Persona } from '../types';

interface PersonaState {
  personas: Persona[];
  loaded: boolean;
  loading: boolean;
  error: string | null;

  fetch: () => Promise<void>;
  create: (data: { title: string; body: string; description?: string }) => Promise<Persona | null>;
  update: (
    id: string,
    data: { title?: string; body?: string; description?: string }
  ) => Promise<Persona | null>;
  remove: (id: string) => Promise<boolean>;
}

// Team-shared persona library (§10.8 Phase 4). Everyone reads/uses any persona;
// only the creator or an admin may edit/delete (enforced server-side; the UI
// hides those affordances via `canModifyPersona` below).
export const usePersonaStore = create<PersonaState>((set, get) => ({
  personas: [],
  loaded: false,
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    const res = await personaApi.list();
    if (res.success && res.data) {
      set({ personas: res.data, loaded: true, loading: false });
    } else {
      set({ loading: false, error: res.error || 'Failed to load personas' });
    }
  },

  create: async (data) => {
    const res = await personaApi.create(data);
    if (res.success && res.data) {
      set({ personas: [res.data, ...get().personas] });
      return res.data;
    }
    set({ error: res.error || 'Failed to create persona' });
    return null;
  },

  update: async (id, data) => {
    const res = await personaApi.update(id, data);
    if (res.success && res.data) {
      const updated = res.data;
      set({ personas: get().personas.map((p) => (p.id === id ? updated : p)) });
      return updated;
    }
    set({ error: res.error || 'Failed to update persona' });
    return null;
  },

  remove: async (id) => {
    const res = await personaApi.delete(id);
    if (res.success) {
      set({ personas: get().personas.filter((p) => p.id !== id) });
      return true;
    }
    set({ error: res.error || 'Failed to delete persona' });
    return false;
  },
}));

/** Whether the current user (by id/role) may edit or delete this persona. */
export function canModifyPersona(
  persona: Persona,
  user: { id: string; role: string } | null | undefined
): boolean {
  if (!user) return false;
  return user.role === 'admin' || (persona.createdBy != null && persona.createdBy === user.id);
}

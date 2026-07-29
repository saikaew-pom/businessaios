/**
 * Auth store
 */

import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { getMe, login as apiLogin, register as apiRegister, logout as apiLogout, getMeFull, type User, type FullUser } from './api';

export const user = writable<User | null>(null);
export const fullUser = writable<FullUser | null>(null);
export const authLoading = writable<boolean>(true);

export async function initAuth() {
  if (!browser) return;
  authLoading.set(true);
  try {
    const [basic, full] = await Promise.all([
      getMe(),
      getMeFull().catch(() => null),
    ]);
    user.set(basic);
    fullUser.set(full);
  } catch {
    user.set(null);
    fullUser.set(null);
  } finally {
    authLoading.set(false);
  }
}

export async function refreshFullUser() {
  if (!browser) return;
  const f = await getMeFull().catch(() => null);
  fullUser.set(f);
}

export async function login(email: string, password: string, otp?: string, turnstile_token?: string) {
  const res = await apiLogin(email, password, otp, turnstile_token);
  user.set(res.user);
  await refreshFullUser();
  return res;
}

export async function register(email: string, password: string, opts?: { first_name?: string; last_name?: string; name?: string; turnstile_token?: string }) {
  const res = await apiRegister(email, password, opts);
  user.set(res.user);
  await refreshFullUser();
  return res.user;
}

export async function logout() {
  await apiLogout();
  user.set(null);
  fullUser.set(null);
}

export const isAuthed = derived(user, ($u) => $u !== null);

const AUTH_STORAGE_KEY = 'tvg_auth_user';

export const DUMMY_USERNAME = 'Mehaboob';
export const DUMMY_PASSWORD = 'tvg123';

export function getCurrentAuthUser() {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.username) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loginWithDummy(username, password) {
  if (username !== DUMMY_USERNAME || password !== DUMMY_PASSWORD) {
    return { success: false, message: 'Invalid username or password' };
  }

  const session = { username, loginAt: new Date().toISOString() };
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  return { success: true, user: session };
}

export function logout() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

import { createApiAction } from '../create-api-action';

const SOURCE = 'Auth';

export const checkSession = createApiAction<Record<string, never>, { authenticated: boolean }>(
    SOURCE,
    'check session'
);

export const login = createApiAction<{ password: string }, Record<string, never>>(SOURCE, 'login');

export const logout = createApiAction<Record<string, never>, Record<string, never>>(SOURCE, 'logout');

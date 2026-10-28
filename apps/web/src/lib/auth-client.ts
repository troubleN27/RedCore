'use client';

import { adminClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

// Регистрация и вход — server actions; клиенту нужны только сессия и выход
export const authClient = createAuthClient({
  plugins: [adminClient()],
});

export const { useSession, signOut } = authClient;

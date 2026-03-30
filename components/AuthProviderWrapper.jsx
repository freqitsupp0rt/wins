'use client';

import { AuthProvider } from '@/hooks/useAuth';
import IdleTimeoutModal from './Modals/IdleTimeoutModal';

export default function AuthProviderWrapper({ children }) {
  return (
    <AuthProvider>
      {children}
      <IdleTimeoutModal />
    </AuthProvider>
  );
}
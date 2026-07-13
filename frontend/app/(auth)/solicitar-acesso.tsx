import React from 'react'
import { useRouter } from 'expo-router'
import { AccessRequestForm } from '@/screens/auth/AccessRequestForm'
import { MEI_BILLING_PLANS_ROUTE } from '@/lib/settingsRoutes'

export default function SolicitarAcessoScreen() {
  const router = useRouter()
  return (
    <AccessRequestForm
      onGoToLogin={() => router.replace('/(auth)/login')}
      onDone={() => router.replace('/')}
      onRegistered={() => router.replace(MEI_BILLING_PLANS_ROUTE as never)}
    />
  )
}

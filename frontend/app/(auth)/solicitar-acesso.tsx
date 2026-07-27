import React from 'react'
import { useRouter } from 'expo-router'
import { AccessRequestForm } from '@/screens/auth/AccessRequestForm'

/** Cadastro self-serve → login → /planos (Checkout Stripe). */
export default function SolicitarAcessoScreen() {
  const router = useRouter()
  return (
    <AccessRequestForm
      signupMode="self_serve"
      onGoToLogin={() => router.replace('/(auth)/login')}
      onRegistered={() => router.replace('/(app)/planos')}
      onDone={() => router.replace('/(app)/planos')}
    />
  )
}

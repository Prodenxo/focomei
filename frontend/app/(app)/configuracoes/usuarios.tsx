import React from 'react'
import { useRouter, type Href } from 'expo-router'
import ManageUsersScreen from '@/screens/ManageUsersScreen'
import { DEFAULT_APP_HREF } from '@/lib/appNavConfig'
import { resolvePostAuthHref } from '@/lib/authRedirect'
import { goBackToSettings } from '@/lib/settingsRoutes'

export default function ConfiguracoesUsuariosRoute() {
  const router = useRouter()
  return (
    <ManageUsersScreen
      onBack={() => goBackToSettings(router)}
      onImpersonateSuccess={() => {
        void resolvePostAuthHref(DEFAULT_APP_HREF as Href).then((href) => {
          router.replace(href as never)
        })
      }}
    />
  )
}

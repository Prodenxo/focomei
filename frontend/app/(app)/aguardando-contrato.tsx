import { Stack } from 'expo-router'
import AguardandoContratoScreen from '@/screens/AguardandoContratoScreen'

export default function AguardandoContratoRoute () {
  return (
    <>
      <Stack.Screen options={{ headerShown: false, title: 'Assinar contrato' }} />
      <AguardandoContratoScreen />
    </>
  )
}

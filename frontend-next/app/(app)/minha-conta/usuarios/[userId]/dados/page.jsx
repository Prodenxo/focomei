import { AdminUserFiscalPage } from '@/components/settings/AdminUserFiscalPage';

export default async function DadosFiscaisUsuarioPage({ params }) {
  const { userId } = await params;
  return <AdminUserFiscalPage userId={userId} />;
}

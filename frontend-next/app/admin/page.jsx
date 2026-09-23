import { redirect } from 'next/navigation';

export default async function AdminReturnPage({ searchParams }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params?.stripe_mei) query.set('stripe_mei', String(params.stripe_mei));
  if (params?.session_id) query.set('session_id', String(params.session_id));
  query.set('tab', 'billing');
  redirect(`/minha-conta/usuarios?${query.toString()}`);
}

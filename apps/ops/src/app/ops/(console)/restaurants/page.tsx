import { redirect } from 'next/navigation';

/** Restaurant list lives on `/ops`; keep this path as a bookmark alias. */
export default function RestaurantsPage() {
  redirect('/ops');
}

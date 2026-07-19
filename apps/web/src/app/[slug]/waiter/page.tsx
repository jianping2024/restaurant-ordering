import { permanentRedirect } from 'next/navigation';

/** Legacy slug waiter board → single Dashboard entry. */
export default function WaiterPageRedirect() {
  permanentRedirect('/dashboard/waiter');
}

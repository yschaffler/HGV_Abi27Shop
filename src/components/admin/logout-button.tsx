import { logoutAction } from '@/app/login/actions';

export function LogoutButton({ label = 'Abmelden' }: { label?: string }) {
  return (
    <form action={logoutAction}>
      <button type="submit" className="btn-secondary h-9 px-3 text-sm">
        {label}
      </button>
    </form>
  );
}

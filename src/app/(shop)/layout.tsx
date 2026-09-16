import { SiteFooter } from '@/components/shop/site-footer';
import { SiteHeader } from '@/components/shop/site-header';
import { getSettings } from '@/server/settings';

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader shopName={settings.shopName} />
      <main className="flex-1">{children}</main>
      <SiteFooter shopName={settings.shopName} contactEmail={settings.contactEmail} />
    </div>
  );
}

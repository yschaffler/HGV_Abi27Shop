import { prisma } from '@/server/db';
import { createOrderNumber, createPublicToken } from '@/server/crypto/tokens';
import { hashPassword } from '@/server/auth/password';
import { SETTINGS_ID } from '@/server/settings';
import type { Role } from '@/generated/prisma/enums';

/**
 * Kleine Helfer, damit die eigentlichen Tests lesbar bleiben und nicht aus
 * Datenbank-Aufbau bestehen.
 */

export async function createSettings(overrides: { orderStartAt?: Date | null; orderEndAt?: Date | null } = {}) {
  return prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    update: {
      orderStartAt: overrides.orderStartAt ?? null,
      orderEndAt: overrides.orderEndAt ?? null,
    },
    create: {
      id: SETTINGS_ID,
      shopName: 'Testshop',
      contactEmail: 'test@example.de',
      orderStartAt: overrides.orderStartAt ?? null,
      orderEndAt: overrides.orderEndAt ?? null,
      pickupInfo: 'Ausgabe in der Schule.',
      imprintText: '',
      privacyText: '',
      withdrawalText: '',
      termsText: '',
    },
  });
}

export async function createProductWithVariant(
  overrides: {
    slug?: string;
    productActive?: boolean;
    variantActive?: boolean;
    priceCents?: number;
    color?: string;
    size?: string;
  } = {},
) {
  const product = await prisma.product.create({
    data: {
      slug: overrides.slug ?? `produkt-${Math.random().toString(36).slice(2, 10)}`,
      name: 'Abipulli',
      active: overrides.productActive ?? true,
      variants: {
        create: {
          color: overrides.color ?? 'Schwarz',
          size: overrides.size ?? 'M',
          label: '',
          priceCents: overrides.priceCents ?? 3990,
          active: overrides.variantActive ?? true,
        },
      },
    },
    include: { variants: true },
  });

  const variant = product.variants[0];
  if (!variant) throw new Error('Variante wurde nicht angelegt');

  return { product, variant };
}

export async function createPaidOrder(params: {
  variantId: string;
  firstName?: string;
  lastName?: string;
  quantity?: number;
  unitPriceCents?: number;
  itemCount?: number;
}) {
  const quantity = params.quantity ?? 1;
  const unitPriceCents = params.unitPriceCents ?? 3990;
  const itemCount = params.itemCount ?? 1;

  return prisma.order.create({
    data: {
      orderNumber: createOrderNumber(),
      publicToken: createPublicToken(),
      firstName: params.firstName ?? 'Max',
      lastName: params.lastName ?? 'Mustermann',
      email: 'max@example.de',
      totalCents: unitPriceCents * quantity * itemCount,
      paymentStatus: 'PAID',
      paidAt: new Date(),
      items: {
        create: Array.from({ length: itemCount }, (_, index) => ({
          variantId: params.variantId,
          productName: 'Abipulli',
          variantLabel: `Schwarz · Position ${index + 1}`,
          color: 'Schwarz',
          size: 'M',
          unitPriceCents,
          quantity,
          lineTotalCents: unitPriceCents * quantity,
        })),
      },
    },
    include: { items: true },
  });
}

export async function createUser(role: Role, email = `${role.toLowerCase()}@example.de`) {
  return prisma.user.create({
    data: {
      email,
      name: role === 'ADMIN' ? 'Admin Person' : 'Ausgabe Person',
      role,
      passwordHash: await hashPassword('EinSicheresPasswort123'),
      totpConfirmedAt: new Date(),
    },
  });
}

import { Router } from 'express';
import { z } from 'zod';
import { LedgerType, Role } from '@prisma/client';
import { prisma } from '../prisma.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

export const productsRouter = Router();

productsRouter.get('/', async (_req, res) => {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { cacaoPrice: 'asc' },
    include: { seller: { select: { id: true, name: true } } },
  });
  return res.json({ products });
});

productsRouter.use(requireAuth);

const createSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().min(2).max(500),
  cacaoPrice: z.number().int().positive(),
  stock: z.number().int().nonnegative(),
});

productsRouter.post('/', requireRoles(Role.ADMIN, Role.SELLER), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const product = await prisma.product.create({
    data: {
      ...parsed.data,
      sellerId: req.user!.role === Role.SELLER ? req.user!.id : undefined,
    },
  });
  return res.status(201).json({ product });
});

const redeemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().max(50).default(1),
});

productsRouter.post('/redeem', async (req, res) => {
  const parsed = redeemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { productId, quantity } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product || !product.active) throw new Error('PRODUCT');
      if (product.stock < quantity) throw new Error('STOCK');

      const total = product.cacaoPrice * quantity;
      const user = await tx.user.findUnique({ where: { id: req.user!.id } });
      if (!user) throw new Error('USER');
      if (user.cacaoBalance < total) throw new Error('INSUFFICIENT');

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { cacaoBalance: { decrement: total } },
      });
      await tx.product.update({
        where: { id: product.id },
        data: { stock: { decrement: quantity } },
      });

      if (product.sellerId) {
        await tx.user.update({
          where: { id: product.sellerId },
          data: { cacaoBalance: { increment: total } },
        });
      }

      const entry = await tx.ledgerEntry.create({
        data: {
          type: LedgerType.REDEEM,
          amountCacao: total,
          note: `Canje: ${quantity}× ${product.name}`,
          fromUserId: user.id,
          toUserId: product.sellerId ?? undefined,
          meta: JSON.stringify({ productId: product.id, quantity }),
        },
      });

      const redemption = await tx.redemption.create({
        data: {
          userId: user.id,
          productId: product.id,
          cacaoPaid: total,
          quantity,
          ledgerId: entry.id,
        },
        include: { product: true },
      });

      return { updatedUser, redemption, entry };
    });

    return res.status(201).json({
      cacaoBalance: result.updatedUser.cacaoBalance,
      redemption: result.redemption,
      entry: result.entry,
    });
  } catch (e) {
    if (e instanceof Error) {
      const map: Record<string, [number, string]> = {
        PRODUCT: [404, 'Producto no disponible'],
        STOCK: [400, 'Stock insuficiente'],
        USER: [404, 'Usuario no encontrado'],
        INSUFFICIENT: [400, 'Saldo de cacao insuficiente'],
      };
      const hit = map[e.message];
      if (hit) return res.status(hit[0]).json({ error: hit[1] });
    }
    throw e;
  }
});

import { Router } from 'express';
import { z } from 'zod';
import { LedgerType, Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';

export const walletRouter = Router();

walletRouter.use(requireAuth);

walletRouter.get('/balance', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  return res.json({
    cacaoBalance: user.cacaoBalance,
    cacaoPerMxn: config.cacaoPerMxn,
    symbol: '🍫',
    unit: 'cacao',
  });
});

walletRouter.get('/ledger', async (req, res) => {
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      OR: [{ fromUserId: req.user!.id }, { toUserId: req.user!.id }],
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      fromUser: { select: { id: true, name: true, email: true } },
      toUser: { select: { id: true, name: true, email: true } },
      redemption: { include: { product: true } },
    },
  });
  return res.json({ entries });
});

const depositSchema = z.object({
  amountMxn: z.number().positive().max(1_000_000),
  note: z.string().max(200).optional(),
});

/** Simula un depósito en MXN y lo convierte a símbolos cacao (ledger). */
walletRouter.post('/deposit', async (req, res) => {
  const parsed = depositSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { amountMxn, note } = parsed.data;
  const cacao = Math.floor(amountMxn * config.cacaoPerMxn);
  if (cacao < 1) {
    return res.status(400).json({ error: 'Monto demasiado bajo para generar cacao' });
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: req.user!.id },
      data: { cacaoBalance: { increment: cacao } },
    });
    const entry = await tx.ledgerEntry.create({
      data: {
        type: LedgerType.DEPOSIT,
        amountCacao: cacao,
        amountMxn: Math.round(amountMxn * 100) / 100 < 1
          ? Math.round(amountMxn)
          : Math.round(amountMxn),
        note: note ?? `Depósito ${amountMxn} MXN → ${cacao} cacao`,
        toUserId: user.id,
        meta: JSON.stringify({ provider: 'mock-deposit', rate: config.cacaoPerMxn }),
      },
    });
    return { user, entry };
  });

  return res.status(201).json({
    cacaoCredited: cacao,
    amountMxn,
    cacaoBalance: result.user.cacaoBalance,
    entry: result.entry,
  });
});

const transferSchema = z.object({
  toEmail: z.string().email(),
  amountCacao: z.number().int().positive(),
  note: z.string().max(200).optional(),
});

walletRouter.post('/transfer', async (req, res) => {
  const parsed = transferSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { toEmail, amountCacao, note } = parsed.data;
  if (toEmail.toLowerCase() === req.user!.email.toLowerCase()) {
    return res.status(400).json({ error: 'No puedes transferirte a ti mismo' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const from = await tx.user.findUnique({ where: { id: req.user!.id } });
      const to = await tx.user.findUnique({ where: { email: toEmail } });
      if (!from || !to) throw new Error('NOT_FOUND');
      if (from.cacaoBalance < amountCacao) throw new Error('INSUFFICIENT');

      const updatedFrom = await tx.user.update({
        where: { id: from.id },
        data: { cacaoBalance: { decrement: amountCacao } },
      });
      const updatedTo = await tx.user.update({
        where: { id: to.id },
        data: { cacaoBalance: { increment: amountCacao } },
      });

      const out = await tx.ledgerEntry.create({
        data: {
          type: LedgerType.TRANSFER_OUT,
          amountCacao,
          note: note ?? `Transferencia a ${to.email}`,
          fromUserId: from.id,
          toUserId: to.id,
        },
      });
      const inn = await tx.ledgerEntry.create({
        data: {
          type: LedgerType.TRANSFER_IN,
          amountCacao,
          note: note ?? `Transferencia de ${from.email}`,
          fromUserId: from.id,
          toUserId: to.id,
        },
      });
      return { updatedFrom, updatedTo, out, inn };
    });

    return res.status(201).json({
      cacaoBalance: result.updatedFrom.cacaoBalance,
      sent: amountCacao,
      to: { email: result.updatedTo.email, name: result.updatedTo.name },
    });
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === 'NOT_FOUND') return res.status(404).json({ error: 'Destinatario no encontrado' });
      if (e.message === 'INSUFFICIENT') return res.status(400).json({ error: 'Saldo de cacao insuficiente' });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      return res.status(400).json({ error: e.message });
    }
    throw e;
  }
});

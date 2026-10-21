import bcrypt from 'bcryptjs';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('cacao123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@bancocacao.local' },
    update: {},
    create: {
      email: 'admin@bancocacao.local',
      name: 'Administrador',
      passwordHash,
      role: Role.ADMIN,
      cacaoBalance: 1000,
    },
  });

  const seller = await prisma.user.upsert({
    where: { email: 'vendedor@bancocacao.local' },
    update: {},
    create: {
      email: 'vendedor@bancocacao.local',
      name: 'Vendedor Maya',
      passwordHash,
      role: Role.SELLER,
      cacaoBalance: 200,
    },
  });

  const client = await prisma.user.upsert({
    where: { email: 'cliente@bancocacao.local' },
    update: {},
    create: {
      email: 'cliente@bancocacao.local',
      name: 'Cliente Demo',
      passwordHash,
      role: Role.CLIENT,
      cacaoBalance: 50,
    },
  });

  const products = [
    {
      name: 'Chocolate artesanal 70%',
      description: 'Barra de cacao criollo tostado a mano.',
      cacaoPrice: 40,
      stock: 25,
      sellerId: seller.id,
    },
    {
      name: 'Bebida de cacao ceremonial',
      description: 'Mezcla tradicional con especias.',
      cacaoPrice: 25,
      stock: 40,
      sellerId: seller.id,
    },
    {
      name: 'Kit siembra de cacao',
      description: 'Semillas y guía de cultivo comunitario.',
      cacaoPrice: 120,
      stock: 10,
      sellerId: seller.id,
    },
  ];

  for (const p of products) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (!existing) {
      await prisma.product.create({ data: p });
    }
  }

  console.log('Seed OK');
  console.log({
    admin: admin.email,
    seller: seller.email,
    client: client.email,
    password: 'cacao123',
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { walletRouter } from './routes/wallet.js';
import { productsRouter } from './routes/products.js';

const app = express();
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'banco-cacao',
    cacaoPerMxn: config.cacaoPerMxn,
    message: 'Depósitos MXN → símbolos cacao → canje de productos',
  });
});

app.use('/api/auth', authRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/products', productsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno' });
});

app.listen(config.port, () => {
  console.log(`Banco Cacao API en http://localhost:${config.port}`);
});

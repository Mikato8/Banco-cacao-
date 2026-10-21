import { config } from './config.js';
import { createApp } from './app.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`Banco Cacao API en http://localhost:${config.port}`);
});

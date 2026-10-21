import { expect, test, type Page } from '@playwright/test';

const API = process.env.E2E_API_URL ?? 'http://127.0.0.1:4010';
const password = 'e2e-ui-pass-123';

async function registerViaApi(email: string, name: string) {
  const res = await fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, password, role: 'CLIENT' }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`register failed: ${JSON.stringify(body)}`);
  return body as { token: string; user: { id: string; cacaoBalance: number } };
}

async function loginUi(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: /Hola,/ })).toBeVisible();
}

test.describe('UI E2E: depósito y canje', () => {
  test('deposita MXN, ve saldo cacao y canjea un producto', async ({ page }) => {
    const email = `e2e.ui.${Date.now().toString(36)}@bancocacao.test`;
    await registerViaApi(email, 'E2E UI User');
    await loginUi(page, email);

    // Saldo inicial (número principal del balance card)
    const balanceSection = page.getByRole('region', { name: 'Saldo de cacao' });
    await expect(balanceSection).toBeVisible();
    const balanceValue = balanceSection.locator('p').filter({ hasText: 'cacao' }).locator('span').nth(1);
    await expect(balanceValue).toHaveText('0');

    // Depósito 30 MXN → 300 cacao (tasa 10)
    await page.getByLabel('Monto MXN').fill('30');
    await page.getByRole('button', { name: 'Convertir a cacao' }).click();
    await expect(page.getByRole('status')).toContainText(/\+?300 cacao/i);
    await expect(balanceValue).toHaveText('300');

    // Catálogo y canje del producto más barato visible
    const catalog = page.getByRole('region', { name: 'Catálogo de canje' });
    await expect(catalog).toBeVisible();
    const firstCard = catalog.locator('article').first();
    await expect(firstCard).toBeVisible();

    const priceText = await firstCard.locator('span', { hasText: '🍫' }).first().innerText();
    const price = Number(priceText.replace(/[^\d]/g, ''));
    expect(price).toBeGreaterThan(0);

    await firstCard.getByRole('button', { name: /Canjear/ }).click();
    await expect(page.getByRole('status')).toContainText(/Canje exitoso/i);

    const expected = (300 - price).toLocaleString('es-MX');
    await expect(balanceValue).toHaveText(expected);

    // Movimiento de canje en ledger
    const movements = page.getByRole('region', { name: 'Historial de movimientos' });
    await expect(movements.getByText('REDEEM').first()).toBeVisible();
    await expect(movements.getByText('DEPOSIT').first()).toBeVisible();
  });
});

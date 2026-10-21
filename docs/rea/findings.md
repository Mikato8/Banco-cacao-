# REA — hallazgos sobre mercadopago.com.mx

Fecha de captura: 2026-10-21  
Herramienta: REA `capture_browser_scenario` (Playwright, Chromium headless)

## Alcance y ética

- Se observó **solo la superficie pública** sin credenciales ni tokens de sesión.
- **No** se clona la marca, assets ni APIs de Mercado Pago.
- El producto **Banco Cacao** es una reconstrucción **original** de un wallet multiusuario inspirado en patrones genéricos de billetera digital (saldo, depósito, movimientos, catálogo).

## Evidence IDs

| Escenario | Evidence ID | Resultado |
|-----------|-------------|-----------|
| `https://www.mercadopago.com.mx/home` | `ev_6c47cd750b0483b816e92d456077a30c26617ab53bc9d27e9363eb0b96b0c4cb` | Página de error / empty-state |
| `https://www.mercadopago.com.mx/` | `ev_a623b518619c0ec1701efab92bdbfd30b2f49ce5139a83513968653b12e9696b` | HTTP **403** + empty-state |

## Observaciones (confidence: observed)

1. **Protección de borde**: la respuesta del documento raíz fue `403` con cabeceras CDN (`x-amz-cf-*`, `via`, `x-cache`). El automatizado headless no recibe la app autenticada.
2. **Empty-state React**: DOM con `data-reactroot`, título *“Hubo un error accediendo a esta pagina...”* y enlace a Mercado Libre.
3. **Assets compartidos ML**: CSS/logo desde `http2.mlstatic.com/ui/navigation/...` (navegación lite de Mercado Libre).
4. **`/home` sin sesión**: no expone wallet; requiere autenticación real del usuario (no se intentó).

## Inferencias (no observadas en runtime autenticado)

Patrones típicos de un wallet digital que **sí** implementamos en Banco Cacao de forma original:

| Patrón genérico | Implementación Banco Cacao |
|-----------------|----------------------------|
| Saldo principal destacado | Balance de **cacao** por usuario |
| Ingreso de fondos | Depósito MXN → conversión a cacao |
| Historial de movimientos | Ledger append-only |
| Acciones rápidas | Depositar, transferir, canjear |
| Multiusuario / roles | Admin, Seller, Client (JWT) |
| Catálogo canjeable | Productos con precio en cacao |

## Limitaciones / unknowns

- No se inspeccionó el bundle JS autenticado ni APIs privadas de MP.
- No hay evidencia de flujos de pago reales, webhooks ni KYC.
- Cualquier semejanza de UX es **diseño propio**, no ingeniería inversa de código propietario.

## Conclusión

REA confirmó que la home de MP no es inspeccionable de forma anónima/automatizada (403 / error). Banco Cacao avanza como **sistema original** de monedero simbólico multiusuario en TypeScript.

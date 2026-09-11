// Escenarios HTTP actuales; las regresiones detalladas están en test:sql.
import { integration } from './lib/integration.mjs';
await integration('scales');

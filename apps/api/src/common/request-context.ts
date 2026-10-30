import { AsyncLocalStorage } from 'node:async_hooks';

// Contexto minimo: nunca almacenar cookies, cuerpo, cabeceras ni credenciales.
export const httpContext = new AsyncLocalStorage<{ requestId: string }>();

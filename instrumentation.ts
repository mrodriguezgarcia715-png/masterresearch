// Soluciona UNABLE_TO_VERIFY_LEAF_SIGNATURE en Node.js/Windows en desarrollo.
// Node.js 18+ usa undici para fetch(); NODE_TLS_REJECT_UNAUTHORIZED no lo afecta.
// Se debe configurar el dispatcher global de undici directamente.
export async function register() {
  if (process.env.NODE_ENV !== "production") {
    const { Agent, setGlobalDispatcher } = await import("undici");
    setGlobalDispatcher(new Agent({ connect: { rejectUnauthorized: false } }));
  }
}

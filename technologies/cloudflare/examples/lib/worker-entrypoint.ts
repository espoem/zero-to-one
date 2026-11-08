export interface Env {
  TEST_KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/kv") {
      const key = url.searchParams.get("key") ?? "default";
      if (request.method === "POST") {
        const val = await request.text();
        await env.TEST_KV.put(key, val);
        return new Response("Stored", { status: 201 });
      }
      const val = await env.TEST_KV.get(key);
      return new Response(val ?? "Not Found", { status: val ? 200 : 404 });
    }
    return new Response("OK", { status: 200 });
  }
};

import { createFileRoute } from '@tanstack/react-router'
import { apiClient } from '#/lib/rpc'

// Demo del cableado RPC end-to-end. El loader corre en el servidor durante el
// SSR: llama al backend de auth con el cliente tipado. El método (`$get`), el
// path (`api.users.me`) y el tipo de la respuesta se infieren del servidor Hono
// vía `AppType`; renombrar o mover ese endpoint en el backend rompería este
// archivo en tiempo de compilación. `/api/users/me` exige sesión, así que sin
// cookie devuelve 401: es el resultado esperado y confirma que la llamada llega.
export const Route = createFileRoute('/')({
  component: Home,
  loader: async () => {
    try {
      const res = await apiClient.api.users.me.$get({ param: {} })
      if (res.status === 401) {
        return { reachable: true as const, authenticated: false as const }
      }
      const data = await res.json()
      return { reachable: true as const, authenticated: true as const, data }
    } catch {
      // El backend no responde (no levantado / CORS). No es un fallo de tipos.
      return { reachable: false as const }
    }
  },
})

function Home() {
  const state = Route.useLoaderData()

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-4xl font-bold">Elineas Admin</h1>
      <p className="text-lg text-gray-600">
        Panel de administración (TanStack Start) sobre el RPC tipado de Hono.
      </p>

      <div className="rounded-lg border p-4 text-sm">
        <p className="font-semibold">Estado del backend de auth</p>
        {!state.reachable && (
          <p className="text-red-600">
            No se pudo contactar el backend. ¿Está levantado en{' '}
            <code>VITE_BACKEND_URL</code>?
          </p>
        )}
        {state.reachable && !state.authenticated && (
          <p className="text-amber-600">
            Backend alcanzable ✅ — respondió <code>401</code> a{' '}
            <code>GET /api/users/me</code> (falta sesión). El cliente RPC está
            tipado y conectado.
          </p>
        )}
        {state.reachable && state.authenticated && (
          <pre className="mt-2 overflow-x-auto rounded bg-gray-100 p-2">
            {JSON.stringify(state.data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}

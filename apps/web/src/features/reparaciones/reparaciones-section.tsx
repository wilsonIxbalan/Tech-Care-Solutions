import { useEffect, useRef, useState } from 'react'
import { EmptyState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ReparacionCatalogos } from '@/features/reparaciones/reparacion-catalogos'
import { ReparacionForm } from '@/features/reparaciones/reparacion-form'

export function ReparacionesSection({ catalogos = {} }: { catalogos?: ReparacionCatalogos }) {
  const [showForm, setShowForm] = useState(false)
  const newButtonRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (wasOpen.current && !showForm) newButtonRef.current?.focus()
    wasOpen.current = showForm
  }, [showForm])

  return (
    <section aria-labelledby="reparaciones-title" className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="reparaciones-title" className="text-xl font-semibold">Reparaciones</h2>
        {!showForm && <Button ref={newButtonRef} onClick={() => setShowForm(true)}>Preparar reparación</Button>}
      </div>
      {showForm && <ReparacionForm catalogos={catalogos} onCancel={() => setShowForm(false)} />}
      <EmptyState title="Consulta de reparaciones pendiente de conexión" description="El listado estará disponible cuando se conecte la API. Validar el formulario no crea ninguna reparación." />
      <Card>
        <CardHeader><CardTitle>Después de registrar la reparación</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-5 md:grid-cols-3">
            <div><dt className="text-sm font-semibold">Actividades</dt><dd className="mt-2 text-sm text-muted-foreground">Interfaz de actividades todavía no preparada. Su integración requiere una reparación registrada en proceso.</dd></div>
            <div><dt className="text-sm font-semibold">Finalización</dt><dd className="mt-2 text-sm text-muted-foreground">Interfaz de revisión y confirmación todavía no preparada. La operación requiere una reparación registrada y autorización del servidor.</dd></div>
            <div><dt className="text-sm font-semibold">Consumo de repuestos</dt><dd className="mt-2 text-sm text-muted-foreground">Interfaz de consumo todavía no preparada. El servidor deberá comprobar existencias y registrar los movimientos de inventario.</dd></div>
          </dl>
        </CardContent>
      </Card>
    </section>
  )
}

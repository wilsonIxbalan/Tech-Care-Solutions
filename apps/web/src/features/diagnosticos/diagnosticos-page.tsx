import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import type { DiagnosticoCatalogos } from '@/features/diagnosticos/diagnostico-catalogos'
import { DiagnosticoForm } from '@/features/diagnosticos/diagnostico-form'

export function DiagnosticosPage({ catalogos = {} }: { catalogos?: DiagnosticoCatalogos }) {
  const [showForm, setShowForm] = useState(false)
  const newButtonRef = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (wasOpen.current && !showForm) newButtonRef.current?.focus()
    wasOpen.current = showForm
  }, [showForm])

  return (
    <>
      <PageHeader
        eyebrow="TechCare / Servicio técnico"
        title="Diagnósticos y reparaciones"
        description="Prepara los datos del diagnóstico. La sección de reparaciones está pendiente de implementación."
      />

      <section aria-labelledby="diagnosticos-title" className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="diagnosticos-title" className="text-xl font-semibold">Diagnósticos</h2>
          {!showForm && <Button ref={newButtonRef} onClick={() => setShowForm(true)}>Nuevo diagnóstico</Button>}
        </div>
        {showForm && <DiagnosticoForm catalogos={catalogos} onCancel={() => setShowForm(false)} />}
        <EmptyState
          title="Consulta de diagnósticos pendiente de conexión"
          description="El listado de diagnósticos estará disponible cuando se conecte la API."
        />
      </section>

      <section aria-labelledby="reparaciones-title" className="space-y-5">
        <h2 id="reparaciones-title" className="text-xl font-semibold">Reparaciones</h2>
        <EmptyState
          title="Reparaciones pendientes de implementación"
          description="Esta sección aún no registra reparaciones, actividades ni consumo de repuestos."
        />
      </section>
    </>
  )
}

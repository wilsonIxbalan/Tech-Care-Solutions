import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import type { DiagnosticoCatalogos } from '@/features/diagnosticos/diagnostico-catalogos'
import { DiagnosticoForm } from '@/features/diagnosticos/diagnostico-form'
import type { ReparacionCatalogos } from '@/features/reparaciones/reparacion-catalogos'
import { ReparacionesSection } from '@/features/reparaciones/reparaciones-section'

export function DiagnosticosPage({ catalogos = {}, reparacionCatalogos }: { catalogos?: DiagnosticoCatalogos; reparacionCatalogos?: ReparacionCatalogos }) {
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
        description="Prepara diagnósticos e inicios de reparación. El registro y las operaciones posteriores dependen de conectar la API."
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

      <ReparacionesSection catalogos={reparacionCatalogos} />
    </>
  )
}

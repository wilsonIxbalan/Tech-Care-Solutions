import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import type { OrdenCatalogos } from '@/features/ordenes/orden-catalogos'
import { OrdenForm } from '@/features/ordenes/orden-form'

export function OrdenesPage({ catalogos = {} }: { catalogos?: OrdenCatalogos }) {
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
        eyebrow="TechCare / Recepción"
        title="Órdenes de servicio"
        description="Recepción de equipos para servicio técnico."
        actions={!showForm && <Button ref={newButtonRef} onClick={() => setShowForm(true)}>Nueva orden</Button>}
      />

      {showForm && <OrdenForm catalogos={catalogos} onCancel={() => setShowForm(false)} />}

      <EmptyState
        title="Consulta de órdenes pendiente de conexión"
        description="El listado de órdenes estará disponible cuando se conecte la API."
      />
    </>
  )
}

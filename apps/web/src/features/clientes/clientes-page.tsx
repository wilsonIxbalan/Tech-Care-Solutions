import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { ClienteForm } from '@/features/clientes/cliente-form'

export function ClientesPage() {
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
        title="Clientes"
        description="Registro de clientes individuales y empresariales."
        actions={
          !showForm && (
            <Button ref={newButtonRef} onClick={() => setShowForm(true)}>
              Nuevo cliente
            </Button>
          )
        }
      />

      {showForm && <ClienteForm onCancel={() => setShowForm(false)} />}

      <EmptyState
        title="Consulta de clientes pendiente de conexión"
        description="Aquí aparecerán los clientes registrados cuando se conecte la API."
      />
    </>
  )
}

import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EquipoForm } from '@/features/equipos/equipo-form'
import type { EquipoCatalogos } from '@/features/equipos/equipo-catalogos'

export function EquiposPage({ catalogos = {} }: { catalogos?: EquipoCatalogos }) {
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
        title="Equipos"
        description="Registro de equipos y consulta de su historial por número de serie."
        actions={!showForm && <Button ref={newButtonRef} onClick={() => setShowForm(true)}>Nuevo equipo</Button>}
      />

      {showForm && <EquipoForm catalogos={catalogos} onCancel={() => setShowForm(false)} />}

      <Card>
        <CardHeader>
          <CardTitle>Historial por número de serie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="historial-numero-serie">Número de serie para historial</Label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              id="historial-numero-serie"
              type="search"
              maxLength={60}
              aria-describedby="historial-pendiente"
            />
            <Button type="button" disabled aria-describedby="historial-pendiente">Consultar historial</Button>
          </div>
          <p id="historial-pendiente" className="text-sm text-muted-foreground">
            La consulta del historial está pendiente de conectar la API. Todavía no se ha realizado ninguna búsqueda.
          </p>
        </CardContent>
      </Card>

      <EmptyState
        title="Consulta de equipos pendiente de conexión"
        description="El listado de equipos estará disponible cuando se conecte la API."
      />
    </>
  )
}

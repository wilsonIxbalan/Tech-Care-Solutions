import { Link } from 'react-router-dom'
import { businessModules } from '@/app/navigation'
import { PageHeader } from '@/components/shared/page-header'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function WorkspacePage() {
  return (
    <>
      <PageHeader
        eyebrow="TechCare Solutions"
        title="Servicio técnico, de principio a fin"
        description="Selecciona un módulo para validar borradores o revisar las vistas preparadas. Las consultas y operaciones reales siguen pendientes de conectar la API."
      />

      <div className="rounded-xl border bg-card p-5 text-sm leading-7">
        <p className="font-semibold">Flujo de servicio</p>
        <p>
          Cliente → Equipo → Orden → Diagnóstico → Reparación →
          Factura → Pago → Entrega
        </p>

        <p className="mt-3 font-semibold">Abastecimiento</p>
        <p>
          Proveedor → Compra → Recepción → Inventario →
          Repuesto utilizado
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {businessModules.map((module) => (
          <Link
            key={module.path}
            to={module.path}
            className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Card className="h-full transition-colors hover:border-primary">
              <CardHeader>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{['/inventario', '/reportes'].includes(module.path) ? 'Vista preparada' : 'Formulario preparado'}</Badge>
                  <Badge variant="outline">Conexión pendiente</Badge>
                </div>
                <CardTitle>{module.title}</CardTitle>
              </CardHeader>

              <CardContent>
                <p className="text-sm leading-6 text-muted-foreground">
                  {module.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  )
}

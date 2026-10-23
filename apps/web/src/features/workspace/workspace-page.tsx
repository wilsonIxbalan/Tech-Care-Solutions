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
        description="Selecciona un módulo para consultar su alcance. Las pantallas de negocio están pendientes de implementación."
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
                <Badge variant="outline" className="w-fit">
                  Por implementar
                </Badge>
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
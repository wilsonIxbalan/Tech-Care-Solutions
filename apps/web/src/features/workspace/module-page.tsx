import { Link } from 'react-router-dom'
import { businessModules } from '@/app/navigation'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'

type BusinessModule = (typeof businessModules)[number]

export function ModulePage({ module }: { module: BusinessModule }) {
  return (
    <>
      <PageHeader
        eyebrow="TechCare / Módulos"
        title={module.title}
        description={module.description}
      />

      <EmptyState
        title="Módulo pendiente de implementación"
        description={module.workflow}
        action={
          <Button asChild variant="outline">
            <Link to="/">Volver al inicio</Link>
          </Button>
        }
      />
    </>
  )
}
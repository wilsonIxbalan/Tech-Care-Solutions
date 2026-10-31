import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, BellRing, Blocks, Check, CircleCheck, Code2, Database, Info, Layers3, LoaderCircle, Palette, Plus, ShieldCheck } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/states'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label, RequiredMark } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type { OrderState } from '@/types/api'

const exampleSchema = z.object({
  nombre: z.string().trim().min(3, 'Escribe al menos 3 caracteres.'),
  email: z.email({ error: 'Escribe un correo válido.' }),
})
type ExampleValues = z.infer<typeof exampleSchema>

const palette = [
  { name: 'Primario', value: '#0F766E', token: 'primary' },
  { name: 'Navegación', value: '#0B1628', token: 'sidebar' },
  { name: 'Fondo', value: '#F4F7FB', token: 'background' },
  { name: 'Texto', value: '#0F172A', token: 'foreground' },
  { name: 'Peligro', value: '#B91C1C', token: 'destructive' },
]

const orders: OrderState[] = ['RECIBIDO', 'DIAGNOSTICO', 'ESPERANDO_AUTORIZACION', 'REPARACION', 'LISTO', 'ENTREGADO', 'CANCELADO']

function SectionHeading({ index, title, description }: { index: string; title: string; description: string }) {
  return <div className="mb-5 flex items-start gap-3"><span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg border bg-card font-mono text-[11px] text-muted-foreground">{index}</span><div><h2 className="text-lg font-semibold tracking-tight">{title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p></div></div>
}

export function DesignSystemPage() {
  const form = useForm<ExampleValues>({ resolver: zodResolver(exampleSchema), defaultValues: { nombre: '', email: '' } })
  function submitExample() {
    toast.success('Formulario de ejemplo validado', { description: 'No se guardaron datos ni se llamó a la API.' })
  }

  return (
    <>
      <section id="base" className="space-y-7">
        <PageHeader eyebrow="TechCare / Sistema visual" title="Una base clara para construir juntos." description="El punto de partida de Cristian: componentes, estilos y patrones compartidos para crear una interfaz consistente sin perder tiempo en lo repetitivo." actions={<Button asChild><a href="#componentes">Explorar componentes <ArrowRight /></a></Button>} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { icon: Blocks, label: 'Componentes base', value: '16 primitivas', detail: 'shadcn/ui + Radix' },
            { icon: Palette, label: 'Diseño consistente', value: 'Un solo tema', detail: 'Tokens y estados compartidos' },
            { icon: Code2, label: 'Stack frontend', value: 'React + TypeScript', detail: 'Vite · Tailwind · pnpm' },
            { icon: Database, label: 'Integración prevista', value: 'API → SQL Server', detail: 'Sin conexión desde la interfaz' },
          ].map(({ icon: Icon, label, value, detail }) => <Card key={label}><CardContent className="p-5"><div className="mb-5 flex items-center justify-between"><p className="text-[11px] font-medium text-muted-foreground">{label}</p><Icon className="size-4 text-primary" aria-hidden="true" /></div><p className="text-[17px] font-semibold tracking-tight">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{detail}</p></CardContent></Card>)}
        </div>
        <Alert className="border-teal-200 bg-teal-50/60"><Info className="text-primary" aria-hidden="true" /><AlertTitle>Esto es un kit, no un dashboard de negocio</AlertTitle><AlertDescription>Los ejemplos no consultan la base de datos. Login, pantallas, permisos y datos reales se implementarán con los contratos del equipo.</AlertDescription></Alert>
      </section>

      <section id="componentes">
        <SectionHeading index="01" title="Los mismos elementos, en cada pantalla" description="Primitivas reutilizables, con foco visible y variantes que comunican la intención." />
        <div className="grid items-start gap-5 xl:grid-cols-[1.3fr_1fr]">
          <Card><CardHeader><CardTitle>Acciones y notificaciones</CardTitle><CardDescription>Una acción principal. Alternativas discretas. Confirmación antes de afectar un proceso.</CardDescription></CardHeader><CardContent className="space-y-6">
            <div className="flex flex-wrap gap-2"><Button onClick={() => toast.success('Notificación de ejemplo', { description: 'Aquí se mostrará un resultado confirmado por la API.' })}><Plus />Acción principal</Button><Button variant="outline" onClick={() => toast.info('Acción secundaria de ejemplo')}>Secundaria</Button><Button variant="ghost" onClick={() => toast.info('Acción discreta de ejemplo')}>Discreta</Button></div>
            <Separator />
            <div className="flex flex-wrap items-center gap-3"><Button variant="secondary" size="sm" onClick={() => toast.info('Sonner está listo para usar')}><BellRing />Probar Sonner</Button><Button size="sm" disabled><LoaderCircle className="animate-spin" />Procesando</Button><ConfirmDialog title="Confirmación de ejemplo" description="Este diálogo muestra el patrón de confirmación. No elimina registros ni modifica la base de datos." confirmLabel="Confirmar ejemplo" destructive trigger={<Button variant="outline" size="sm" className="text-destructive">Confirmación</Button>} onConfirm={() => { toast.success('Ejemplo confirmado; sin cambios en la BD') }} /></div>
            <div className="flex flex-wrap gap-2"><Badge><Check className="size-3" />Activo</Badge><Badge variant="secondary">Referencia</Badge><Badge variant="outline">Pendiente</Badge><Badge variant="destructive">Requiere atención</Badge></div>
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Paleta y tokens</CardTitle><CardDescription>Colores semánticos definidos una sola vez.</CardDescription></CardHeader><CardContent className="space-y-3">
            {palette.map(({ name, value, token }) => <div key={token} className="flex items-center gap-3"><span className="size-9 shrink-0 rounded-lg border" style={{ backgroundColor: value }} aria-hidden="true" /><div className="flex-1"><p className="text-xs font-medium">{name}</p><p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{token}</p></div><code className="text-[11px] text-muted-foreground">{value}</code></div>)}
          </CardContent></Card>
        </div>
      </section>

      <section id="formularios">
        <SectionHeading index="02" title="Formularios que ayudan, no estorban" description="Etiquetas claras, errores junto al campo y validación antes de enviar." />
        <div className="grid gap-5 xl:grid-cols-2">
          <Card><CardHeader><CardTitle>Patrón de captura</CardTitle><CardDescription>Ejemplo con React Hook Form + Zod. No guarda información.</CardDescription></CardHeader><CardContent>
            <form onSubmit={form.handleSubmit(submitExample)} className="space-y-5" noValidate>
              <div className="space-y-2"><Label htmlFor="example-name">Nombre de referencia <RequiredMark /></Label><Input id="example-name" placeholder="Escribe un nombre de prueba" autoComplete="off" aria-required="true" aria-invalid={Boolean(form.formState.errors.nombre)} aria-describedby={form.formState.errors.nombre ? 'name-error' : undefined} {...form.register('nombre')} />{form.formState.errors.nombre && <p id="name-error" role="alert" className="text-xs text-destructive">{form.formState.errors.nombre.message}</p>}</div>
              <div className="space-y-2"><Label htmlFor="example-email">Correo de prueba <RequiredMark /></Label><Input id="example-email" type="email" placeholder="ejemplo@correo.test" autoComplete="off" aria-required="true" aria-invalid={Boolean(form.formState.errors.email)} aria-describedby={form.formState.errors.email ? 'email-error' : undefined} {...form.register('email')} />{form.formState.errors.email && <p id="email-error" role="alert" className="text-xs text-destructive">{form.formState.errors.email.message}</p>}</div>
              <div className="flex items-center justify-between gap-3 border-t pt-4"><p className="text-[11px] text-muted-foreground">Los datos del ejemplo permanecen en esta página.</p><Button type="submit" size="sm">Validar ejemplo <ArrowRight /></Button></div>
            </form>
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Campos complementarios</CardTitle><CardDescription>Entradas listas para reutilizar en las features.</CardDescription></CardHeader><CardContent className="space-y-5">
            <div className="space-y-2"><Label htmlFor="example-priority">Selector de ejemplo</Label><NativeSelect id="example-priority" defaultValue="normal"><option value="baja">Baja</option><option value="normal">Normal</option><option value="alta">Alta</option></NativeSelect></div>
            <div className="space-y-2"><Label htmlFor="example-notes">Observaciones</Label><Textarea id="example-notes" placeholder="Contexto breve para el siguiente integrante…" /></div>
            <div className="flex items-center gap-2.5"><Checkbox id="example-check" defaultChecked /><Label htmlFor="example-check" className="text-xs font-normal leading-5 text-muted-foreground">Las etiquetas también funcionan al hacer clic.</Label></div>
          </CardContent></Card>
        </div>
      </section>

      <section id="estados">
        <SectionHeading index="03" title="Siempre hay algo que comunicar" description="Los estados de negocio y de la interfaz se muestran con texto, no solo con color." />
        <Card className="mb-5"><CardHeader><CardTitle>Estados de la orden</CardTitle><CardDescription>Estos códigos coinciden con el contrato. Son ejemplos visuales, no órdenes reales.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2">{orders.map((state) => <StatusBadge key={state} state={state} />)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Carga, vacío y error</CardTitle><CardDescription>Reutiliza estos patrones. No reemplaces un error de API con datos inventados.</CardDescription></CardHeader><CardContent>
          <Tabs defaultValue="empty"><TabsList aria-label="Estados de interfaz"><TabsTrigger value="empty">Sin registros</TabsTrigger><TabsTrigger value="loading">Cargando</TabsTrigger><TabsTrigger value="error">Error</TabsTrigger></TabsList>
            <TabsContent value="empty"><EmptyState title="Aquí aparecerán tus registros" description="Explica el siguiente paso y ofrece una acción cuando el rol tenga permiso." action={<Button size="sm" variant="outline" onClick={() => toast.info('La pantalla de creación la implementará Cristian')}><Plus />Acción de ejemplo</Button>} /></TabsContent>
            <TabsContent value="loading"><LoadingState label="El servicio puede estar iniciándose. Estamos consultando…" /></TabsContent>
            <TabsContent value="error"><ErrorState description="No se pudo completar la consulta. Este es un ejemplo del mensaje para una dependencia temporalmente no disponible." onRetry={() => toast.info('Ejemplo de reintento de lectura; no se llamó a la API')} /></TabsContent>
          </Tabs>
        </CardContent></Card>
      </section>

      <section id="comenzar">
        <SectionHeading index="04" title="Patrones compartidos de interfaz" description="Ejemplos de tabla para reutilizar los mismos componentes en cada pantalla." />
        <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Componente</TableHead><TableHead>Uso en la interfaz</TableHead><TableHead>Origen en el código</TableHead></TableRow></TableHeader><TableBody>
          {[
            ['Button', 'Acciones y confirmaciones', 'components/ui/button.tsx'],
            ['Input', 'Captura y validación visual', 'components/ui/input.tsx'],
            ['StatusBadge', 'Estado con etiqueta e icono', 'components/shared/status-badge.tsx'],
            ['ErrorState', 'Error comprensible y reintento de lectura', 'components/shared/states.tsx'],
          ].map(([name, task, guide]) => <TableRow key={name}><TableCell className="font-medium">{name}</TableCell><TableCell className="text-muted-foreground">{task}</TableCell><TableCell><code className="whitespace-nowrap text-[11px] text-muted-foreground">{guide}</code></TableCell></TableRow>)}
        </TableBody></Table></CardContent></Card>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">{[
          { icon: Layers3, title: 'Cada cosa en su capa', text: 'features para pantallas; ui para primitivas; lib para HTTP y utilidades.' },
          { icon: ShieldCheck, title: 'El backend autoriza', text: 'Ocultar botones mejora UX, pero no reemplaza la validación de permisos.' },
          { icon: CircleCheck, title: 'Un PR pequeño, validado', text: 'Prueba, bitácora y contrato al día antes de integrar con el equipo.' },
        ].map(({ icon: Icon, title, text }) => <div key={title} className="rounded-lg border bg-card/60 p-4"><Icon className="mb-3 size-4 text-primary" aria-hidden="true" /><h3 className="text-xs font-semibold">{title}</h3><p className="mt-1.5 text-xs leading-6 text-muted-foreground">{text}</p></div>)}</div>
      </section>
    </>
  )
}

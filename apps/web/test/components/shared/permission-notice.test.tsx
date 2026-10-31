import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PermissionNotice } from '@/components/shared/permission-notice'
import { adminUser, renderWithSession } from '../../support/session'

describe('PermissionNotice', () => {
  it('explica qué roles pueden realizar la acción cuando falta el permiso', () => {
    renderWithSession(<PermissionNotice permission="CLIENTES_GESTIONAR" action="registrar o editar clientes" />, { user: { ...adminUser, roles: ['TECNICO'], permisos: ['REPORTES_VER'] } })
    expect(screen.getByRole('note')).toHaveTextContent('Tu rol (Técnico) no puede registrar o editar clientes. Lo pueden hacer: Administrador, Recepción.')
  })
  it('no muestra nada si la sesión tiene el permiso', () => {
    renderWithSession(<PermissionNotice permission="CLIENTES_GESTIONAR" action="registrar o editar clientes" />)
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })
})

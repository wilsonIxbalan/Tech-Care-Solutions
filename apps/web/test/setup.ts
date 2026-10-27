import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// Cold lazy imports can exceed one second on shared Windows workers.
configure({ asyncUtilTimeout: 5_000 })
afterEach(() => cleanup())

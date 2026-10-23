import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'

const fake = vi.hoisted(() => ({ session: null as Session | null, active: true, signIn: vi.fn(), signOut: vi.fn() }))
vi.mock('../lib/cloud/client', () => ({ getCloudClient: () => ({
  auth: { getSession: async () => ({ data: { session: fake.session }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }), signInWithPassword: fake.signIn, signOut: fake.signOut, resetPasswordForEmail: vi.fn() },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { active: fake.active }, error: null }) }) }) }),
}) }))
vi.mock('../App', () => ({ default: () => <div>受保护的学习页面</div> }))
vi.mock('../lib/cloud/sync', () => ({ createCloudSync: () => ({ start: vi.fn(), stop: vi.fn(), sync: vi.fn(), resolve: vi.fn() }) }))
import { CloudApp } from './CloudApp'
import { selectDatabaseAccount } from '../lib/db'

afterEach(async () => { cleanup(); fake.session = null; fake.active = true; vi.clearAllMocks(); await selectDatabaseAccount(null) })

it('requires a login and does not expose public registration', async () => {
  fake.signIn.mockResolvedValue({ error: { message: 'invalid' } })
  render(<CloudApp />)
  const email = await screen.findByLabelText('邮箱')
  expect(screen.queryByText('受保护的学习页面')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '注册' })).not.toBeInTheDocument()
  fireEvent.change(email, { target: { value: 'invited@example.com' } })
  fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'example-password' } })
  fireEvent.click(screen.getByRole('button', { name: '登录' }))
  await waitFor(() => expect(fake.signIn).toHaveBeenCalledWith({ email: 'invited@example.com', password: 'example-password' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('邮箱或密码')
})

it('does not mount user data for a disabled account', async () => {
  fake.active = false
  fake.session = { user: { id: '11111111-1111-4111-8111-111111111111', email: 'disabled@example.com' } } as Session
  render(<CloudApp />)
  expect(await screen.findByRole('alert')).toHaveTextContent('尚未启用')
  expect(screen.queryByText('受保护的学习页面')).not.toBeInTheDocument()
})

it('opens only the authenticated account database after checking access', async () => {
  fake.session = { user: { id: '22222222-2222-4222-8222-222222222222', email: 'invited@example.com' } } as Session
  render(<CloudApp />)
  expect(await screen.findByText('受保护的学习页面')).toBeInTheDocument()
  expect(screen.getByText('invited@example.com')).toBeInTheDocument()
})

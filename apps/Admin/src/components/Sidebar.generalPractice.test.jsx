import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import Sidebar from './Sidebar'

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ logout: vi.fn(), user: { role: 'admin' }, isAuthenticated: true, isBootstrapping: false }) }))
vi.mock('../contexts/AdminBadgeContext', () => ({ useAdminBadges: () => ({ badges: {} }) }))
vi.mock('../services/contactLeadService', () => ({ fetchUnreadContactLeadCount: vi.fn().mockResolvedValue({ count: 0 }) }))

function CurrentPath() { const location = useLocation(); return <span data-testid="path">{location.pathname}</span> }

it('keeps Course Quizzes separate and highlights General Practice on details routes', async () => {
  render(<MemoryRouter initialEntries={['/general-practice/quiz-1']}><Sidebar isOpen /><CurrentPath /></MemoryRouter>)
  const practice = screen.getByRole('button', { name: 'General Practice' })
  expect(practice.className).toContain('bg-[#E58C1A]')
  expect(screen.getByRole('button', { name: 'Quizzes' }).className).not.toContain('bg-[#E58C1A]')
  await userEvent.setup().click(screen.getByRole('button', { name: 'Quizzes' }))
  expect(screen.getByTestId('path').textContent).toBe('/quizzes')
  await userEvent.setup().click(screen.getByRole('button', { name: 'General Practice' }))
  expect(screen.getByTestId('path').textContent).toBe('/general-practice')
})

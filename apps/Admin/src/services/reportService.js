import { apiClient } from '../api/client'
import { getToken } from '../api/tokenStorage'

export async function fetchReportSummary({ period, startDate, endDate }) {
  const params = new URLSearchParams()
  if (period !== 'all' && !startDate && !endDate) params.set('days', period)
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  const query = params.toString() ? `?${params.toString()}` : ''
  return apiClient.get(`/reports/summary${query}`)
}

export async function downloadReportCsv(type, { period, startDate, endDate }) {
  const params = new URLSearchParams({ type })
  if (period !== 'all' && !startDate && !endDate) params.set('days', period)
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/reports/export?${params.toString()}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  if (!response.ok) throw new Error('Unable to export report data')
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${type}-${period === 'all' ? 'all-time' : period}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

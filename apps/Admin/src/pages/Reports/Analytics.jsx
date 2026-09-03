import { AlertTriangle, BarChart3, CheckCircle2, ChevronDown, ChevronUp, CircleDollarSign, Clock3, Download, ExternalLink, RefreshCw, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fetchCourses } from '../../services/courseService'
import { fetchAllPayments } from '../../services/paymentService'
import { downloadReportCsv, fetchReportSummary } from '../../services/reportService'
import { fetchUsers } from '../../services/userService'

const dateFilters = [
  { label: 'All time', value: 'all' },
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 30 days', value: '30' },
  { label: 'Last 90 days', value: '90' },
]

const paymentsPerPage = 8

function getPaymentAmount(payment) {
  return Number(payment.amountValue ?? String(payment.amount || '').replace(/[^\d.-]/g, '')) || 0
}

function getPaymentDate(payment) {
  const parsedDate = new Date(payment.date)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

function getUserDate(user) {
  const parsedDate = new Date(user.createdAt)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

function isInReportRange(date, period, startDate, endDate) {
  const parsedDate = date ? new Date(date) : null
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) return false
  if (startDate && parsedDate < new Date(`${startDate}T00:00:00`)) return false
  if (endDate && parsedDate > new Date(`${endDate}T23:59:59`)) return false
  if (period === 'all' || startDate || endDate) return true
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - Number(period))
  return parsedDate >= cutoff
}

function Analytics() {
  const [users, setUsers] = useState([])
  const [courses, setCourses] = useState([])
  const [payments, setPayments] = useState([])
  const [summary, setSummary] = useState(null)
  const [period, setPeriod] = useState('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [appliedCustomRange, setAppliedCustomRange] = useState({ startDate: '', endDate: '' })
  const [sortDirection, setSortDirection] = useState('desc')
  const [isMetricsExpanded, setIsMetricsExpanded] = useState(true)
  const [isPaymentStatusExpanded, setIsPaymentStatusExpanded] = useState(true)
  const [isTopCoursesExpanded, setIsTopCoursesExpanded] = useState(true)
  const [isRevenueByCourseExpanded, setIsRevenueByCourseExpanded] = useState(true)
  const [paymentPage, setPaymentPage] = useState(1)
  const [paymentSearch, setPaymentSearch] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('all')
  const [reportLoadedAt, setReportLoadedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    async function loadReports() {
      try {
        setLoading(true)
        setError('')
        const [loadedUsers, loadedCourses, loadedPayments, loadedSummary] = await Promise.all([
          fetchUsers(),
          fetchCourses(),
          fetchAllPayments(),
          fetchReportSummary({ period, ...appliedCustomRange }),
        ])
        setUsers(loadedUsers)
        setCourses(loadedCourses)
        setPayments(loadedPayments)
        setSummary(loadedSummary)
        setReportLoadedAt(new Date())
      } catch (loadError) {
        setError(loadError.message || 'Unable to load reports')
      } finally {
        setLoading(false)
      }
    }

    loadReports()
  }, [period, appliedCustomRange, refreshKey])

  const activeStartDate = appliedCustomRange.startDate
  const activeEndDate = appliedCustomRange.endDate

  const filteredUsers = useMemo(() => {
    return users.filter((user) => isInReportRange(getUserDate(user), period, activeStartDate, activeEndDate))
  }, [users, period, activeStartDate, activeEndDate])

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => isInReportRange(getPaymentDate(payment), period, activeStartDate, activeEndDate))
  }, [payments, period, activeStartDate, activeEndDate])

  const insights = useMemo(() => {
    const approvedPayments = filteredPayments.filter((payment) => payment.status === 'approved')
    const statusCounts = summary?.statusCounts || filteredPayments.reduce((counts, payment) => {
      counts[payment.status] = (counts[payment.status] || 0) + 1
      return counts
    }, {})
    const topCourses = [...(summary?.coursePerformance || [])].sort((firstCourse, secondCourse) => secondCourse.count - firstCourse.count).map((course) => [course.courseName, course.count])
    const totalRevenue = summary?.revenue ?? approvedPayments.reduce((total, payment) => total + getPaymentAmount(payment), 0)
    const pendingPayments = filteredPayments.filter((payment) => payment.status === 'pending')
    const localRevenueTrend = Array.from({ length: 7 }, (_, index) => {
      const date = new Date()
      date.setHours(0, 0, 0, 0)
      date.setDate(date.getDate() - (6 - index))
      const total = approvedPayments
        .filter((payment) => {
          const paymentDate = getPaymentDate(payment)
          return paymentDate && paymentDate.toDateString() === date.toDateString()
        })
        .reduce((sum, payment) => sum + getPaymentAmount(payment), 0)
      return { label: date.toLocaleDateString(undefined, { weekday: 'short' }), total }
    })

    const approvalRate = filteredPayments.length ? (approvedPayments.length / filteredPayments.length) * 100 : 0
    const averagePayment = approvedPayments.length ? totalRevenue / approvedPayments.length : 0
    return { approvedPayments, statusCounts, topCourses, totalRevenue, pendingPayments, approvalRate, averagePayment, revenueTrend: summary?.revenueTrend?.map((trend) => ({ label: new Date(`${trend.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' }), total: trend.revenue })) || localRevenueTrend }
  }, [filteredPayments, summary])

  const visiblePayments = useMemo(() => {
    const query = paymentSearch.trim().toLowerCase()
    return filteredPayments.filter((payment) => {
      const matchesStatus = paymentStatus === 'all' || payment.status === paymentStatus
      const matchesSearch = !query || [payment.userName, payment.userEmail, payment.courseName].some((value) => String(value || '').toLowerCase().includes(query))
      return matchesStatus && matchesSearch
    })
  }, [filteredPayments, paymentSearch, paymentStatus])

  const courseRows = useMemo(() => {
    const performanceByName = new Map((summary?.coursePerformance || []).map((course) => [course.courseName, course]))
    return courses.map((course) => {
      const performance = performanceByName.get(course.title)
      const enrolments = performance?.count || 0
      const revenue = performance?.revenue || 0
      return { ...course, enrolments, revenue, average: enrolments ? revenue / enrolments : 0 }
    }).sort((firstCourse, secondCourse) => sortDirection === 'desc' ? secondCourse.revenue - firstCourse.revenue : firstCourse.revenue - secondCourse.revenue)
  }, [courses, summary, sortDirection])

  const revenueChartData = courseRows.filter((course) => course.revenue > 0).slice(0, 8).map((course) => ({
    name: course.title.length > 18 ? `${course.title.slice(0, 18)}...` : course.title,
    revenue: course.revenue,
  }))

  const paginatedPayments = visiblePayments.slice((paymentPage - 1) * paymentsPerPage, paymentPage * paymentsPerPage)
  const totalPaymentPages = Math.max(1, Math.ceil(visiblePayments.length / paymentsPerPage))
  const oldestPendingDate = summary?.pendingPayment?.createdAt ? new Date(summary.pendingPayment.createdAt) : null
  const pendingAge = oldestPendingDate ? Math.max(0, Math.floor((Date.now() - oldestPendingDate.getTime()) / 86400000)) : 0
  const reportPeriodLabel = activeStartDate || activeEndDate ? `${activeStartDate || 'Start'} to ${activeEndDate || 'Present'}` : period === 'all' ? 'All time' : `Last ${period} days`
  const filePeriod = reportPeriodLabel.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const exportOptions = { period, ...appliedCustomRange }
  const handleExport = async (type) => {
    try {
      await downloadReportCsv(type, exportOptions)
    } catch (exportError) {
      setError(exportError.message || 'Unable to export report data')
    }
  }
  const handleExportUsers = () => handleExport('users')
  const handleExportCourses = () => handleExport('courses')
  const handleExportPayments = () => handleExport('payments')
  const handleExportPdf = () => {
    const document = new jsPDF()
    document.setFontSize(18)
    document.text('Reports & Insights', 14, 18)
    document.setFontSize(10)
    document.setTextColor(100)
    document.text(`Reporting period: ${reportPeriodLabel}`, 14, 26)
    document.text(`Generated: ${new Date().toLocaleString()}`, 14, 32)
    document.setTextColor(0)

    autoTable(document, {
      startY: 40,
      head: [['Metric', 'Value']],
      body: [
        ['Gross revenue', `${(summary?.grossRevenue ?? insights.totalRevenue).toLocaleString()} THB`],
        ['Net revenue', `${insights.totalRevenue.toLocaleString()} THB`],
        ['Approved payments', String(summary?.approvedPayments ?? insights.approvedPayments.length)],
        ['Approval rate', `${insights.approvalRate.toFixed(1)}%`],
        ['Pending payments', String(insights.pendingPayments.length)],
      ],
      theme: 'grid',
      headStyles: { fillColor: [55, 65, 81] },
      styles: { fontSize: 9 },
    })

    autoTable(document, {
      startY: document.lastAutoTable.finalY + 10,
      head: [['Course', 'Enrolments', 'Revenue', 'Average']],
      body: courseRows.map((course) => [course.title, course.enrolments, `${course.revenue.toLocaleString()} THB`, `${course.average.toLocaleString(undefined, { maximumFractionDigits: 2 })} THB`]),
      theme: 'striped',
      headStyles: { fillColor: [245, 158, 11] },
      styles: { fontSize: 8 },
    })

    autoTable(document, {
      startY: document.lastAutoTable.finalY + 10,
      head: [['Date', 'User', 'Course', 'Amount', 'Status']],
      body: filteredPayments.map((payment) => [payment.date, payment.userName, payment.courseName, `${getPaymentAmount(payment).toLocaleString()} THB`, payment.status]),
      theme: 'grid',
      headStyles: { fillColor: [55, 65, 81] },
      styles: { fontSize: 7 },
    })

    document.save(`reports-${filePeriod}.pdf`)
  }
  const handlePresetChange = (value) => {
    setPeriod(value)
    setAppliedCustomRange({ startDate: '', endDate: '' })
    setPaymentPage(1)
  }
  const handlePaymentFilterChange = (setter, value) => {
    setter(value)
    setPaymentPage(1)
  }
  const handleCustomRangeApply = () => {
    if (!customStartDate && !customEndDate) return
    if (customStartDate && customEndDate && customStartDate > customEndDate) {
      setError('The custom report start date must be before the end date.')
      return
    }
    setError('')
    setPeriod('custom')
    setAppliedCustomRange({ startDate: customStartDate, endDate: customEndDate })
    setPaymentPage(1)
  }

  return (
    <div className="min-h-full bg-[#f7f8fa] p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Performance overview</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Reports & insights</h1>
            <p className="mt-1 text-sm text-gray-500">A simple view of sales, enrolments, and audience activity.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {dateFilters.map((filter) => (
              <button key={filter.value} type="button" onClick={() => handlePresetChange(filter.value)} className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${period === filter.value && !activeStartDate && !activeEndDate ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:border-gray-400'}`}>
                {filter.label}
              </button>
            ))}
            <button type="button" onClick={() => setRefreshKey((current) => current + 1)} className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600 hover:border-gray-400" title="Refresh reports">
              <RefreshCw size={16} />Refresh
            </button>
          </div>
        </div>

        <div className="mb-5 flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs font-semibold uppercase tracking-wide text-gray-500">From<input type="date" value={customStartDate} onChange={(event) => setCustomStartDate(event.target.value)} className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-700 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100" /></label>
          <label className="flex-1 text-xs font-semibold uppercase tracking-wide text-gray-500">To<input type="date" value={customEndDate} onChange={(event) => setCustomEndDate(event.target.value)} className="mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-700 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100" /></label>
          <button type="button" onClick={handleCustomRangeApply} className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700">Apply custom range</button>
        </div>

        {error ? <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="mb-5 flex flex-col justify-between gap-1 text-xs text-gray-500 sm:flex-row sm:items-center"><span>Reporting period: <strong className="font-semibold text-gray-700">{reportPeriodLabel}</strong></span>{reportLoadedAt ? <span>Updated {reportLoadedAt.toLocaleString()}</span> : null}</div>

        {loading ? <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">Loading reports...</div> : (
          <>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">Summary metrics</h2><button type="button" onClick={() => setIsMetricsExpanded((current) => !current)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-900">{isMetricsExpanded ? 'Collapse' : 'Expand'} {isMetricsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button></div>
            {isMetricsExpanded ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Gross revenue', value: `${(summary?.grossRevenue ?? insights.totalRevenue).toLocaleString()} ฿`, icon: CircleDollarSign },
                { label: 'Net revenue', value: `${insights.totalRevenue.toLocaleString()} ฿`, icon: CircleDollarSign },
                { label: 'Approved payments', value: summary?.approvedPayments ?? insights.approvedPayments.length, icon: CheckCircle2 },
                { label: period === 'all' ? 'Registered users' : 'New users', value: summary?.userCount ?? filteredUsers.length, icon: Users },
                { label: 'Rejected payments', value: insights.statusCounts.rejected || 0, icon: AlertTriangle },
                { label: 'Average payment', value: `${insights.averagePayment.toLocaleString(undefined, { maximumFractionDigits: 2 })} ฿`, icon: CircleDollarSign },
                { label: 'Approval rate', value: `${insights.approvalRate.toFixed(1)}%`, icon: CheckCircle2 },
                { label: 'Pending payments', value: insights.pendingPayments.length, icon: Clock3 },
              ].map((stat) => {
                const Icon = stat.icon
                return <div key={stat.label} className="rounded-lg border border-gray-200 bg-white p-4"><div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{stat.label}</span><Icon size={18} className={stat.label === 'Rejected payments' ? 'text-red-500' : 'text-gray-400'} /></div><p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">{stat.value}</p></div>
              })}
            </div> : null}

            <div className="mt-5 rounded-lg border border-gray-200 border-l-4 border-l-pink-500 bg-white px-5 py-4"><p className="text-xs font-bold uppercase tracking-wider text-gray-500">Key insight</p><p className="mt-1 text-sm text-gray-700">{courseRows.find((course) => course.revenue > 0) ? `${courseRows.find((course) => course.revenue > 0).title} is your top revenue course with ${courseRows.find((course) => course.revenue > 0).revenue.toLocaleString()} ฿.` : 'No approved revenue has been recorded for this period.'}</p></div>

            <div className="mt-6 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
              <section className="rounded-lg border border-gray-200 bg-white p-5 lg:col-span-2">
                <div className="flex items-center justify-between"><button type="button" onClick={() => setIsRevenueByCourseExpanded((current) => !current)} className="flex items-center gap-2 text-left"><span><h2 className="font-bold text-gray-900">Revenue by course</h2><p className="mt-1 text-sm text-gray-500">Approved revenue and enrolments for the selected period.</p></span>{isRevenueByCourseExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}</button><button type="button" onClick={() => setSortDirection((current) => current === 'desc' ? 'asc' : 'desc')} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:border-pink-300">Revenue {sortDirection === 'desc' ? <ChevronDown size={15} /> : <ChevronUp size={15} />}</button></div>
                {isRevenueByCourseExpanded ? <div className="mt-5">{revenueChartData.length ? <ResponsiveContainer width="100%" height={Math.max(280, revenueChartData.length * 52)}><BarChart layout="vertical" data={revenueChartData} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}><CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" horizontal={false} /><XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value.toLocaleString()} ฿`} /><YAxis type="category" dataKey="name" width={125} tick={{ fill: '#4b5563', fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: '#fff7ed' }} formatter={(value) => [`${Number(value).toLocaleString()} ฿`, 'Revenue']} contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} /><Bar dataKey="revenue" fill="#f59e0b" radius={[0, 4, 4, 0]} maxBarSize={30} /></BarChart></ResponsiveContainer> : <p className="py-8 text-center text-sm text-gray-500">No approved revenue in this period.</p>}</div> : null}
              </section>
              <section className="h-full rounded-lg border border-gray-200 bg-white p-5">
                <button type="button" onClick={() => setIsPaymentStatusExpanded((current) => !current)} className="flex w-full items-center justify-between text-left"><span className="font-bold text-gray-900">Payment status</span>{isPaymentStatusExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}</button>
                {isPaymentStatusExpanded ? <div className="mt-5 space-y-4">
                  {['approved', 'pending', 'rejected'].map((status) => {
                    const count = insights.statusCounts[status] || 0
                    const total = filteredPayments.length || 1
                    return <div key={status}><div className="mb-1 flex justify-between text-sm"><span className="capitalize text-gray-600">{status}</span><span className="font-semibold text-gray-900">{count}</span></div><div className="h-2 rounded-full bg-gray-100"><div className={`h-2 rounded-full ${status === 'approved' ? 'bg-green-500' : status === 'pending' ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${(count / total) * 100}%` }} /></div></div>
                  })}
                </div> : null}
              </section>
              <section className="h-full rounded-lg border border-gray-200 bg-white p-5"><button type="button" onClick={() => setIsTopCoursesExpanded((current) => !current)} className="flex w-full items-center justify-between text-left"><span className="font-bold text-gray-900">Top courses by enrolments</span><span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-600">Popular {isTopCoursesExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}</span></button>{isTopCoursesExpanded ? <div className="mt-5 space-y-4">{insights.topCourses.length ? insights.topCourses.map(([courseName, count]) => <div key={courseName}><div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate text-gray-600">{courseName}</span><span className="font-semibold text-gray-900">{count}</span></div><div className="h-2 rounded-full bg-gray-100"><div className="h-2 rounded-full bg-amber-400" style={{ width: `${(count / insights.topCourses[0][1]) * 100}%` }} /></div></div>) : <p className="text-sm text-gray-500">No approved enrolments in this period.</p>}</div> : null}</section>
            </div>

            <section className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><AlertTriangle size={21} className="mt-0.5 shrink-0 text-amber-600" /><div><h2 className="font-bold text-gray-900">Needs attention</h2><p className="mt-1 text-sm text-gray-700">{insights.pendingPayments.length ? `${insights.pendingPayments.length} payment${insights.pendingPayments.length === 1 ? '' : 's'} waiting for review.` : 'No pending payments in this period.'}{oldestPendingDate ? ` Oldest has been waiting ${pendingAge} day${pendingAge === 1 ? '' : 's'}.` : ''}</p></div></div>{insights.pendingPayments.length ? <button type="button" onClick={() => navigate('/review-payment')} className="inline-flex items-center gap-2 self-start rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-700 sm:self-auto">Review payments<ExternalLink size={15} /></button> : null}</div></section>

            <section className="mt-5 overflow-hidden rounded-lg border border-gray-200 bg-white"><div className="flex flex-col justify-between gap-3 border-b border-gray-200 p-5 sm:flex-row sm:items-center"><div><h2 className="font-bold text-gray-900">Export data</h2><p className="mt-1 text-sm text-gray-500">Download the current report period as CSV or PDF.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={handleExportPayments} className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-700"><Download size={16} />Payments</button><button type="button" onClick={handleExportUsers} className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-gray-400"><Download size={16} />Users</button><button type="button" onClick={handleExportCourses} className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-gray-400"><Download size={16} />Courses</button><button type="button" onClick={handleExportPdf} className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"><Download size={16} />PDF report</button></div></div><div className="flex flex-col gap-3 border-b border-gray-200 p-5 sm:flex-row"><input type="search" value={paymentSearch} onChange={(event) => handlePaymentFilterChange(setPaymentSearch, event.target.value)} placeholder="Search user, email, or course" className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none focus:border-gray-400 sm:flex-1" /><select value={paymentStatus} onChange={(event) => handlePaymentFilterChange(setPaymentStatus, event.target.value)} className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none focus:border-gray-400"><option value="all">All statuses</option><option value="approved">Approved</option><option value="pending">Pending</option><option value="rejected">Rejected</option></select></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-gray-50 text-xs uppercase text-gray-600"><tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">User</th><th className="px-5 py-3">Course</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Status</th></tr></thead><tbody>{paginatedPayments.map((payment) => <tr key={payment.id} className="border-t border-gray-100"><td className="px-5 py-3 text-gray-500">{payment.date}</td><td className="px-5 py-3 font-medium text-gray-900">{payment.userName}</td><td className="px-5 py-3 text-gray-600">{payment.courseName}</td><td className="px-5 py-3 text-gray-900">{getPaymentAmount(payment).toLocaleString()} ฿</td><td className="px-5 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${payment.status === 'approved' ? 'bg-green-100 text-green-700' : payment.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{payment.status}</span></td></tr>)}</tbody></table>{!visiblePayments.length ? <p className="p-8 text-center text-sm text-gray-500">No payments match these filters.</p> : null}</div><div className="flex items-center justify-between border-t border-gray-200 px-5 py-4 text-sm"><span className="text-gray-500">{visiblePayments.length ? `Showing ${(paymentPage - 1) * paymentsPerPage + 1}-${Math.min(paymentPage * paymentsPerPage, visiblePayments.length)} of ${visiblePayments.length}` : 'No results'}</span><div className="flex gap-2"><button type="button" disabled={paymentPage === 1} onClick={() => setPaymentPage((page) => Math.max(1, page - 1))} className="rounded-md border border-gray-200 px-3 py-1.5 font-semibold text-gray-600 disabled:cursor-not-allowed disabled:opacity-40">Previous</button><button type="button" disabled={paymentPage === totalPaymentPages} onClick={() => setPaymentPage((page) => Math.min(totalPaymentPages, page + 1))} className="rounded-md border border-gray-200 px-3 py-1.5 font-semibold text-gray-600 disabled:cursor-not-allowed disabled:opacity-40">Next</button></div></div></section>
            <style>{`
              table {
                border-collapse: separate;
                border-spacing: 0;
              }
              table thead tr {
                background: #fdf2f8 !important;
              }
              table th {
                letter-spacing: 0.06em;
                font-size: 0.7rem;
                color: #6b7280;
              }
              table tbody tr {
                transition: background-color 150ms ease;
              }
              table tbody tr:nth-child(even) {
                background: #fafafa;
              }
              table tbody tr:hover {
                background: #fff1f6;
              }
              table tbody td {
                border-top-color: #f3f4f6;
                vertical-align: middle;
              }
              table tbody td:nth-child(4) {
                font-weight: 700;
                white-space: nowrap;
              }
              table tbody td:last-child {
                font-size: 0.75rem;
                font-weight: 700;
              }
            `}</style>
          </>
        )}
      </div>
    </div>
  )
}

export default Analytics

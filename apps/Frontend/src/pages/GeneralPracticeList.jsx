import { useEffect, useRef, useState } from "react"
import { ArrowLeft, BookOpenText, RefreshCw, Search } from "lucide-react"
import { Link } from "react-router-dom"
import LoadingSpinner from "../components/LoadingSpinner"
import StudentSelect from "../components/StudentSelect"
import { fetchGeneralPracticeSets } from "../services/generalPracticeService"

const levels = ["Beginner", "Intermediate", "Advanced"]
const difficultyOptions = [{ value: "", label: "All Levels" }, ...levels.map((level) => ({ value: level, label: level }))]

function uniqueSets(items) {
  const seen = new Set()
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

function SetCover({ set }) {
  const [failed, setFailed] = useState(false)
  return <div className="flex aspect-[16/9] w-full shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#FFF1D0] text-[#A94F00]">
    {set.coverImage && !failed
      ? <img src={set.coverImage} alt={`${set.name} cover image`} onError={() => setFailed(true)} className="h-full w-full object-cover" />
      : <div className="flex flex-col items-center gap-2" aria-hidden="true"><BookOpenText className="h-9 w-9" /><span className="text-xs font-bold uppercase tracking-wider">Thai Practice</span></div>}
  </div>
}

function GeneralPracticeList({ publicView = false }) {
  const [search, setSearch] = useState("")
  const [difficulty, setDifficulty] = useState("")
  const [filters, setFilters] = useState({ name: "", difficulty: "" })
  const [sets, setSets] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState("")
  const [pageError, setPageError] = useState("")
  const [retryKey, setRetryKey] = useState(0)
  const requestId = useRef(0)
  const moreInFlight = useRef(false)
  const searchTimer = useRef(null)

  useEffect(() => () => {
    requestId.current += 1
    clearTimeout(searchTimer.current)
  }, [])

  useEffect(() => {
    if (!filters) return
    const currentRequest = ++requestId.current
    fetchGeneralPracticeSets(filters)
      .then((page) => {
        if (currentRequest !== requestId.current) return
        if (!Array.isArray(page?.sets)) throw new Error("Invalid Quiz Set catalog response")
        setSets(uniqueSets(page.sets))
        setNextCursor(page.nextCursor || null)
      })
      .catch((requestError) => {
        if (currentRequest !== requestId.current) return
        setError(!publicView && requestError.status === 401
          ? "Your session has expired. Please sign in again."
          : "We couldn't load Quiz Sets. Please try again.")
      })
      .finally(() => { if (currentRequest === requestId.current) setLoading(false) })
  }, [filters, publicView, retryKey])

  const resetResults = () => {
    requestId.current += 1
    moreInFlight.current = false
    setSets([])
    setNextCursor(null)
    setError("")
    setPageError("")
    setLoadingMore(false)
    setLoading(true)
  }

  const changeSearch = (event) => {
    const value = event.target.value
    clearTimeout(searchTimer.current)
    resetResults()
    setSearch(value)
    setFilters(null)
    searchTimer.current = setTimeout(() => setFilters({ name: value.trim(), difficulty }), 300)
  }

  const changeDifficulty = (value) => {
    clearTimeout(searchTimer.current)
    resetResults()
    setDifficulty(value)
    setFilters({ name: search.trim(), difficulty: value })
  }

  const clearFilters = () => {
    clearTimeout(searchTimer.current)
    resetResults()
    setSearch("")
    setDifficulty("")
    setFilters({ name: "", difficulty: "" })
  }

  const retry = () => {
    resetResults()
    setRetryKey((current) => current + 1)
  }

  const loadMore = async () => {
    if (!filters || !nextCursor || loading || moreInFlight.current) return
    moreInFlight.current = true
    setLoadingMore(true)
    setPageError("")
    const currentRequest = requestId.current
    try {
      const page = await fetchGeneralPracticeSets({ ...filters, after: nextCursor })
      if (currentRequest !== requestId.current) return
      if (!Array.isArray(page?.sets)) throw new Error("Invalid Quiz Set catalog response")
      setSets((previous) => uniqueSets([...previous, ...page.sets]))
      setNextCursor(page.nextCursor || null)
    } catch {
      if (currentRequest === requestId.current) setPageError("We couldn't load more Quiz Sets. Please try again.")
    } finally {
      if (currentRequest === requestId.current) {
        moreInFlight.current = false
        setLoadingMore(false)
      }
    }
  }

  return <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-12">
    <Link to={publicView ? "/" : "/app/practice"} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF1D0] hover:text-[#C97112] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{publicView ? "Back to Home" : "Back to Practice Overview"}</Link>
    <header className="mt-3">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">General Practice</h1>
      <p className="mt-1 text-sm text-[#765F55]">Browse Quiz Sets and find a topic to practice.</p>
    </header>

    <section className="mt-6 rounded-2xl border border-[#2D2E30]/10 bg-white p-4 sm:p-5" aria-label="Find Quiz Sets">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-end">
        <div><label htmlFor="quiz-set-search" className="mb-2 block text-sm font-bold text-[#2D2E30]">Search Quiz Sets by name</label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#765F55]" aria-hidden="true" /><input id="quiz-set-search" type="search" maxLength={100} value={search} onChange={changeSearch} placeholder="Search Quiz Sets" className="h-12 w-full rounded-xl border border-[#D9CEBE] bg-[#FFFDF8] py-2 pl-10 pr-3 text-sm text-[#2D2E30] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00] disabled:cursor-not-allowed disabled:opacity-50" /></div></div>
        <StudentSelect label="Difficulty" value={difficulty} options={difficultyOptions} onChange={changeDifficulty} />
        <button type="button" onClick={clearFilters} disabled={!search && !difficulty} className="inline-flex h-12 items-center justify-center rounded-xl border border-[#D9CEBE] bg-[#FFFDF8] px-4 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF1D0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00] disabled:cursor-not-allowed disabled:opacity-50">Clear filters</button>
      </div>
    </section>

    <section className="mt-5" aria-label="Available Quiz Sets" aria-busy={loading || loadingMore}>
      {loading ? <LoadingSpinner message="Loading Quiz Sets..." /> : error ? <div role="alert" className="rounded-2xl border border-[#2D2E30]/10 bg-white p-6 sm:p-8"><p className="text-sm text-[#765F55]">{error}</p><button type="button" onClick={retry} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#2D2E30]/15 bg-white px-5 py-3 text-sm font-bold text-[#765F55] transition hover:bg-[#FFF9EA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00]"><RefreshCw className="h-4 w-4" aria-hidden="true" />Try again</button></div> : sets.length === 0 ? <div className="rounded-2xl border border-dashed border-[#D9CEBE] bg-white px-6 py-12 text-center"><h2 className="text-lg font-bold">{search || difficulty ? "No Quiz Sets match your search" : "No Quiz Sets available yet"}</h2><p className="mt-2 text-sm text-[#765F55]">{search || difficulty ? "Try a different name or difficulty." : "Check back soon for new General Practice activities."}</p></div> : <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sets.map((set) => <article key={set.id} className="flex min-w-0 flex-col rounded-2xl border border-[#2D2E30]/10 bg-white p-4 shadow-sm sm:p-5">
            <SetCover set={set} />
            <div className="mt-4 min-w-0 flex-1"><h2 className="break-words text-lg font-bold">{set.name}</h2>{set.description ? <p className="mt-2 line-clamp-3 break-words text-sm leading-relaxed text-[#765F55]">{set.description}</p> : null}</div>
            {set.difficulty ? <div className="mt-4"><span className="inline-flex rounded-full bg-[#FFF1D0] px-2.5 py-1 text-sm font-semibold text-[#8C4500]">{set.difficulty}</span></div> : null}
            <Link to={`${publicView ? "/practice/general" : "/app/practice/general"}/sets/${encodeURIComponent(set.id)}`} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#F8C56A] px-5 py-3 text-sm font-bold text-[#2D2E30] transition hover:bg-[#E58C1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00] sm:w-auto" aria-label={`View Quiz Set ${set.name}`}>View Quiz Set</Link>
          </article>)}
        </div>
        {pageError ? <p role="alert" className="mt-5 text-sm font-semibold text-[#A84646]">{pageError}</p> : null}
        {nextCursor ? <button type="button" onClick={loadMore} disabled={loadingMore} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#F8C56A] px-5 py-3 text-sm font-bold text-[#2D2E30] transition hover:bg-[#E58C1A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A94F00] disabled:cursor-wait disabled:opacity-60">{loadingMore ? "Loading more Quiz Sets..." : pageError ? "Retry loading more" : "Load more Quiz Sets"}</button> : null}
      </>}
    </section>
  </div>
}

export default GeneralPracticeList

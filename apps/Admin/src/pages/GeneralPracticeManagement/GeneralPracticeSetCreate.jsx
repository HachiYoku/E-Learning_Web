import { useNavigate } from 'react-router-dom'
import GeneralPracticeSetForm from './GeneralPracticeSetForm'
import { createGeneralPracticeSet } from '../../services/generalPracticeAdminService'

export default function GeneralPracticeSetCreate() {
  const navigate = useNavigate()
  async function create(fields) {
    const set = await createGeneralPracticeSet(fields)
    if (set.status !== 'disabled' || set.version !== 1) throw new Error('The new Set state could not be confirmed.')
    navigate(`/general-practice/sets/${encodeURIComponent(set.id)}`, { replace: true, state: { created: true } })
  }
  return <main className="min-h-full bg-[#FFFDF8] px-4 pb-10 pt-6 sm:px-6 lg:px-10"><div className="mx-auto max-w-3xl"><GeneralPracticeSetForm title="Create Quiz Set" onSave={create} onCancel={() => navigate('/general-practice')} /></div></main>
}

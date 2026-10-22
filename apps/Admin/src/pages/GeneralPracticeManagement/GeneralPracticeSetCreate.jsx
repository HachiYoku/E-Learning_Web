import { useNavigate } from 'react-router-dom'
import GeneralPracticeSetForm from './GeneralPracticeSetForm'
import { createGeneralPracticeSet, uploadGeneralPracticeSetCover } from '../../services/generalPracticeAdminService'

export default function GeneralPracticeSetCreate() {
  const navigate = useNavigate()
  async function create(fields, _version, { file } = {}) {
    const set = await createGeneralPracticeSet(fields)
    if (set.status !== 'disabled' || set.version !== 1) throw new Error('The new Set state could not be confirmed.')
    if (file) {
      try {
        const result = await uploadGeneralPracticeSetCover(set.id, set.version, file)
        navigate(`/general-practice/sets/${encodeURIComponent(set.id)}`, { replace: true,
          state: { created: true, mediaCleanupRetryRequired: result.mediaCleanup === 'retry_required' } }); return
      }
      catch { navigate(`/general-practice/sets/${encodeURIComponent(set.id)}`, { replace: true,
        state: { created: true, coverUploadUncertain: true } }); return }
    }
    navigate(`/general-practice/sets/${encodeURIComponent(set.id)}`, { replace: true, state: { created: true } })
  }
  return <main className="min-h-full bg-[#FFFDF8] px-4 pb-10 pt-6 sm:px-6 lg:px-10"><div className="mx-auto max-w-3xl"><GeneralPracticeSetForm title="Create Quiz Set" onSave={create} onCancel={() => navigate('/general-practice')} /></div></main>
}

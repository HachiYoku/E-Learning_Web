function GeneralPracticePreview({ content, kind }) {
  if (!content) return null
  const isDraft = kind === 'draft'
  return <section aria-label={isDraft ? 'Draft Preview' : 'Published Preview'} className="rounded-2xl border border-[#2D2E30]/10 bg-white p-5 shadow-[0_12px_30px_-24px_rgba(45,46,48,0.45)] sm:p-6">
    <div className="border-b border-[#2D2E30]/10 pb-5">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C97112]">{isDraft ? 'Draft Preview' : 'Published Preview'}</p>
      <h2 className="mt-2 break-words text-2xl font-bold text-[#2D2E30]">{content.title}</h2>
      {content.description ? <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[#765F55]">{content.description}</p> : null}
      <p className="mt-3 text-xs font-semibold text-[#765F55]">{content.category} · {content.difficulty} · Signed-in students · {isDraft ? `Draft version ${content.version}` : `Published revision ${content.revision}`}</p>
    </div>
    <ol className="mt-5 space-y-5">{(content.questions || []).map((question, index) => <li key={question._id || index} className="rounded-xl border border-[#2D2E30]/10 bg-[#FFFDF8] p-4 sm:p-5">
      <h3 className="text-base font-bold text-[#2D2E30]">Question {index + 1}</h3>
      {question.prompt ? <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[#2D2E30]">{question.prompt}</p> : null}
      {question.image ? <img src={question.image} alt={question.imageDecorative ? '' : question.imageAlt || `Question ${index + 1} image`} className="mt-3 max-h-72 w-full rounded-xl object-contain" /> : null}
      {question.audio ? <audio controls preload="none" src={question.audio} aria-label={question.audioLabel || `Question ${index + 1} audio`} className="mt-3 w-full">Audio playback is unavailable.</audio> : null}
      <ol className="mt-4 space-y-2">{(question.options || []).map((option, optionIndex) => <li key={optionIndex} className={`flex min-h-11 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${optionIndex === question.correctAnswer ? 'border-[#246B35]/35 bg-[#EDF8EE] text-[#246B35]' : 'border-[#2D2E30]/10 bg-white text-[#2D2E30]'}`}><span className="break-words">{String.fromCharCode(65 + optionIndex)}. {option}</span>{optionIndex === question.correctAnswer ? <span className="shrink-0 text-xs font-bold">Correct answer</span> : null}</li>)}</ol>
      {question.explanation ? <p className="mt-4 rounded-xl bg-[#FFF9EA] p-3 text-sm text-[#765F55]"><span className="font-bold">Explanation: </span>{question.explanation}</p> : null}
    </li>)}</ol>
    <p className="mt-5 text-xs text-[#765F55]">Admin preview only. No quiz session or attempt is created.</p>
  </section>
}

export default GeneralPracticePreview

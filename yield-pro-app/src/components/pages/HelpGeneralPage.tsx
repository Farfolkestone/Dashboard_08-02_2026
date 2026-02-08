import React, { useEffect, useState } from 'react'
import { BookOpen, RefreshCcw } from 'lucide-react'

export const HelpGeneralPage: React.FC = () => {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const loadHelp = async () => {
    setLoading(true)
    try {
      const res = await fetch('/help/application-guide.md')
      const text = await res.text()
      setContent(text)
    } catch {
      setContent("Impossible de charger l'aide générale pour le moment.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHelp()
  }, [])

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-slate-700" />
            <h2 className="text-3xl font-black tracking-tight text-slate-900">Aide générale de l'application</h2>
          </div>
          <button onClick={loadHelp} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">
            <RefreshCcw className="mr-1 inline h-3 w-3" /> Rafraîchir
          </button>
        </div>
        <p className="text-sm text-slate-500">Documentation rapide des pages, indicateurs, filtres et actions principales.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-500">Chargement du guide...</p>
        ) : (
          <pre className="whitespace-pre-wrap text-sm leading-7 text-slate-800">{content}</pre>
        )}
      </section>
    </div>
  )
}

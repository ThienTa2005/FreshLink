import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

export function useUrlTab(fallback: string) {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || fallback

  const setTab = useCallback((nextTab: string) => {
    setParams(old => {
      if (old.get('tab') === nextTab) return old
      const next = new URLSearchParams(old)
      next.set('tab', nextTab)
      return next
    }, { replace: true })
  }, [setParams])

  return [tab, setTab] as const
}

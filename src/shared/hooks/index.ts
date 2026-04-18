import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useFilterStore } from '@/store'

/* ── Debounce ── */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

/* ── URL filter state sync ── */
export function useURLFilters() {
  const [params, setParams] = useSearchParams()
  const store = useFilterStore()

  // On mount: read URL params into store
  useEffect(() => {
    const from    = params.get('from')
    const to      = params.get('to')
    const pod     = params.get('pod')
    const client  = params.get('client')
    const project = params.get('project')
    const user    = params.get('user')

    if (from && to) store.setDateRange(from, to)
    if (pod)     store.setFilter('pod',     pod)
    if (client)  store.setFilter('client',  client)
    if (project) store.setFilter('project', project)
    if (user)    store.setFilter('user',    user)
  }, []) // eslint-disable-line

  // Sync store → URL
  const syncToURL = useCallback(() => {
    const p = new URLSearchParams()
    if (store.dateFrom)  p.set('from',    store.dateFrom)
    if (store.dateTo)    p.set('to',      store.dateTo)
    if (store.pod)       p.set('pod',     store.pod)
    if (store.client)    p.set('client',  store.client)
    if (store.project)   p.set('project', store.project)
    if (store.user)      p.set('user',    store.user)
    setParams(p)
  }, [store, setParams])

  return { syncToURL }
}

/* ── Copy to clipboard ── */
export function useClipboard(timeout = 2000) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const copy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setCopied(false), timeout)
  }, [timeout])

  return { copied, copy }
}

/* ── Outside click ── */
export function useOutsideClick<T extends HTMLElement>(callback: () => void) {
  const ref = useRef<T>(null)
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) callback()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [callback])
  return ref
}

/* ── Window size ── */
export function useWindowSize() {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const handler = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return size
}

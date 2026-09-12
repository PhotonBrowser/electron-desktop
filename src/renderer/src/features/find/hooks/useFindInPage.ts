import type { KeyboardEvent, RefObject } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { EMPTY_FIND_STATE, resultState, type FindState } from "../find-state"
import type { FindController } from "../find.types"

interface UseFindInPageOptions {
  controller: FindController | null
  loading: boolean
}

interface FindActions {
  state: FindState
  isOpen: boolean
  inputRef: RefObject<HTMLInputElement | null>
  open: () => void
  close: () => void
  setQuery: (query: string) => void
  next: () => void
  previous: () => void
  handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
}

export function useFindInPage({ controller, loading }: UseFindInPageOptions): FindActions {
  const [isOpen, setIsOpen] = useState(false)
  const [state, setState] = useState<FindState>(EMPTY_FIND_STATE)
  const inputRef = useRef<HTMLInputElement>(null)
  const queryRef = useRef("")
  const requestIdRef = useRef<number | null>(null)

  const stopFind = useCallback((target: FindController | null): void => {
    requestIdRef.current = null
    try {
      target?.stop()
    } catch {
      // A guest can disappear between a tab update and this cleanup.
    }
  }, [])

  const runSearch = useCallback(
    (target: FindController | null, query: string, forward = true): void => {
      if (!target || !query || loading) return
      try {
        requestIdRef.current = target.find(query, forward)
      } catch {
        requestIdRef.current = null
      }
    },
    [loading],
  )

  useEffect(() => {
    if (!controller) return
    const unsubscribe = controller.subscribe((result) => {
      if (result.requestId !== requestIdRef.current) return
      setState(resultState(queryRef.current, result.activeMatchOrdinal, result.matches))
    })
    return () => {
      unsubscribe()
      stopFind(controller)
    }
  }, [controller, stopFind])

  useEffect(() => {
    if (!isOpen) return
    setState({ query: queryRef.current, activeMatch: 0, matches: 0 })
    if (loading) {
      stopFind(controller)
      return
    }
    runSearch(controller, queryRef.current)
  }, [controller, isOpen, loading, runSearch, stopFind])

  useEffect(() => {
    const unsubscribe = window.photon.onFocusFind(() => {
      setIsOpen(true)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      })
    })
    return unsubscribe
  }, [])

  const open = useCallback((): void => {
    setIsOpen(true)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }, [])

  const close = useCallback((): void => {
    stopFind(controller)
    setState(EMPTY_FIND_STATE)
    setIsOpen(false)
    controller?.focus()
  }, [controller, stopFind])

  const setQuery = useCallback(
    (query: string): void => {
      queryRef.current = query
      stopFind(controller)
      setState({ query, activeMatch: 0, matches: 0 })
      runSearch(controller, query)
    },
    [controller, runSearch, stopFind],
  )

  const move = useCallback(
    (forward: boolean): void => {
      runSearch(controller, queryRef.current, forward)
    },
    [controller, runSearch],
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>): void => {
      if (event.key === "Escape") {
        event.preventDefault()
        close()
      } else if (event.key === "Enter") {
        event.preventDefault()
        move(!event.shiftKey)
      }
    },
    [close, move],
  )

  return {
    state,
    isOpen,
    inputRef,
    open,
    close,
    setQuery,
    next: () => move(true),
    previous: () => move(false),
    handleKeyDown,
  }
}

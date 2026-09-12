import { useEffect, useRef, useState, type DragEvent } from "react"
import type { BrowserTab, TabId } from "@/shared/photon-api"
import { hasSameTabOrder } from "../tab-utils"

interface UseTabReorderingResult {
  orderedTabs: BrowserTab[]
  draggedTabId: TabId | null
  dropTargetTabId: TabId | null
  handleDragStart: (event: DragEvent<HTMLDivElement>, tabId: TabId) => void
  handleDragOver: (event: DragEvent<HTMLDivElement>, tabId: TabId) => void
  handleDrop: (event: DragEvent<HTMLDivElement>, tabId: TabId) => void
  handleDragEnd: () => void
}

export function useTabReordering(tabs: BrowserTab[]): UseTabReorderingResult {
  const [orderedTabIds, setOrderedTabIds] = useState<TabId[]>(() => tabs.map((tab) => tab.id))
  const orderedTabIdsRef = useRef(orderedTabIds)
  const pendingOrderRef = useRef<TabId[] | null>(null)
  const tabsRef = useRef(tabs)
  const draggedTabIdRef = useRef<TabId | null>(null)
  const dropCompletedRef = useRef(false)
  const [draggedTabId, setDraggedTabId] = useState<TabId | null>(null)
  const [dropTargetTabId, setDropTargetTabId] = useState<TabId | null>(null)

  useEffect(() => {
    tabsRef.current = tabs
    const snapshotOrder = tabs.map((tab) => tab.id)
    const pendingOrder = pendingOrderRef.current
    if (pendingOrder) {
      const pendingIsValid =
        pendingOrder.length === snapshotOrder.length &&
        pendingOrder.every((tabId) => snapshotOrder.includes(tabId))
      if (!pendingIsValid || hasSameTabOrder(pendingOrder, snapshotOrder)) {
        pendingOrderRef.current = null
      } else {
        return
      }
    }

    if (hasSameTabOrder(orderedTabIdsRef.current, snapshotOrder)) return
    orderedTabIdsRef.current = snapshotOrder
    setOrderedTabIds(snapshotOrder)
  }, [tabs])

  const handleReorder = (nextOrder: TabId[]): void => {
    const nextOrderCopy = [...nextOrder]
    if (hasSameTabOrder(orderedTabIdsRef.current, nextOrderCopy)) return
    pendingOrderRef.current = nextOrderCopy
    orderedTabIdsRef.current = nextOrderCopy
    setOrderedTabIds(nextOrderCopy)
  }

  const commitReorder = (): void => {
    const pendingOrder = pendingOrderRef.current
    if (!pendingOrder) return

    void window.photon.tabs.reorder(pendingOrder).catch(() => {
      pendingOrderRef.current = null
      const snapshotOrder = tabsRef.current.map((tab) => tab.id)
      orderedTabIdsRef.current = snapshotOrder
      setOrderedTabIds(snapshotOrder)
    })
  }

  const resetLocalOrder = (): void => {
    pendingOrderRef.current = null
    const snapshotOrder = tabsRef.current.map((tab) => tab.id)
    orderedTabIdsRef.current = snapshotOrder
    setOrderedTabIds(snapshotOrder)
  }

  const handleDragStart = (event: DragEvent<HTMLDivElement>, tabId: TabId): void => {
    draggedTabIdRef.current = tabId
    setDraggedTabId(tabId)
    dropCompletedRef.current = false
    setDropTargetTabId(null)
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", tabId)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>, targetTabId: TabId): void => {
    const draggedTabId = draggedTabIdRef.current
    if (!draggedTabId || draggedTabId === targetTabId) return

    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    setDropTargetTabId((currentTarget) =>
      currentTarget === targetTabId ? currentTarget : targetTabId,
    )
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>, targetTabId: TabId): void => {
    event.preventDefault()
    dropCompletedRef.current = true

    const draggedTabId = draggedTabIdRef.current
    if (!draggedTabId || draggedTabId === targetTabId) return

    const sourceIndex = orderedTabIdsRef.current.indexOf(draggedTabId)
    const targetIndex = orderedTabIdsRef.current.indexOf(targetTabId)
    if (sourceIndex < 0 || targetIndex < 0) return

    const targetBounds = event.currentTarget.getBoundingClientRect()
    const dropBeforeTarget = event.clientX < targetBounds.left + targetBounds.width / 2
    const nextOrder = orderedTabIdsRef.current.filter((tabId) => tabId !== draggedTabId)
    const nextTargetIndex = nextOrder.indexOf(targetTabId)
    if (nextTargetIndex < 0) return

    const insertAt = dropBeforeTarget ? nextTargetIndex : nextTargetIndex + 1
    nextOrder.splice(insertAt, 0, draggedTabId)
    handleReorder(nextOrder)
    commitReorder()
  }

  const handleDragEnd = (): void => {
    draggedTabIdRef.current = null
    setDraggedTabId(null)
    setDropTargetTabId(null)
    if (!dropCompletedRef.current) resetLocalOrder()
    dropCompletedRef.current = false
  }

  const tabById = new Map(tabs.map((tab) => [tab.id, tab]))
  const orderedIdSet = new Set(orderedTabIds)
  const visibleTabIds = [
    ...orderedTabIds.filter((tabId) => tabById.has(tabId)),
    ...tabs.map((tab) => tab.id).filter((tabId) => !orderedIdSet.has(tabId)),
  ]
  const orderedTabs = visibleTabIds
    .map((tabId) => tabById.get(tabId))
    .filter((tab): tab is BrowserTab => tab !== undefined)

  return {
    orderedTabs,
    draggedTabId,
    dropTargetTabId,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
  }
}

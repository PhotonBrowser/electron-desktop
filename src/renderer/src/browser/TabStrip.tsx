import { memo, useEffect, useRef, useState, type DragEvent } from "react"
import { Asterisk, BedDouble, Globe2, LoaderCircle, Plus, X } from "lucide-react"
import type { BrowserTab as BrowserTabState, TabId } from "@/preload/photon-api"
import { IconButton } from "../ui/IconButton"
import { useBrowserStore } from "../stores/browser-store"

interface BrowserTabProps {
  tab: BrowserTabState
}

function areBrowserTabPropsEqual(previous: BrowserTabProps, next: BrowserTabProps): boolean {
  const previousTab = previous.tab
  const nextTab = next.tab
  return (
    previousTab.id === nextTab.id &&
    previousTab.url === nextTab.url &&
    previousTab.title === nextTab.title &&
    previousTab.faviconUrl === nextTab.faviconUrl &&
    previousTab.loading === nextTab.loading &&
    previousTab.lifecycleState === nextTab.lifecycleState &&
    previousTab.canGoBack === nextTab.canGoBack &&
    previousTab.canGoForward === nextTab.canGoForward
  )
}

function hasSameTabOrder(first: readonly TabId[], second: readonly TabId[]): boolean {
  return first.length === second.length && first.every((tabId, index) => tabId === second[index])
}

const BrowserTab = memo(function BrowserTab({ tab }: BrowserTabProps): React.JSX.Element {
  const isActive = useBrowserStore((state) => state.activeTabId === tab.id)

  return (
    <div
      aria-selected={isActive}
      className={isActive ? "photon-tab photon-tab-active" : "photon-tab photon-tab-inactive"}
      role="tab"
      tabIndex={0}
      onClick={() => void window.photon.tabs.select(tab.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          void window.photon.tabs.select(tab.id)
        }
      }}
    >
      <span aria-hidden="true" className="photon-tab-active-background" />
      <span className="photon-tab-content">
        <span className="photon-tab-icon">
          {tab.lifecycleState === "frozen" ? (
            <BedDouble aria-label="Suspended tab" size={14} />
          ) : tab.loading ? (
            <LoaderCircle aria-label="Loading" className="animate-spin" size={14} />
          ) : tab.kind === "internal" ? (
            <Asterisk aria-label="Photon" size={14} />
          ) : (
            <>
              <Globe2 aria-hidden="true" size={14} />
              {tab.faviconUrl && (
                <img
                  key={tab.faviconUrl}
                  alt=""
                  className="photon-tab-favicon"
                  height={14}
                  src={tab.faviconUrl}
                  width={14}
                  onError={(event) => {
                    event.currentTarget.hidden = true
                  }}
                />
              )}
            </>
          )}
        </span>
        <span className="photon-tab-title">{tab.title || "New Tab"}</span>
        <IconButton
          ariaLabel="Close tab"
          className="photon-tab-close"
          size="sm"
          variant="ghost"
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onPress={() => {
            void window.photon.tabs.close(tab.id)
          }}
        >
          <X aria-hidden="true" size={14} />
        </IconButton>
      </span>
    </div>
  )
}, areBrowserTabPropsEqual)

export function TabStrip(): React.JSX.Element {
  const tabs = useBrowserStore((state) => state.tabs)
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

  const tabById = new Map(tabs.map((tab) => [tab.id, tab]))
  const orderedIdSet = new Set(orderedTabIds)
  const visibleTabIds = [
    ...orderedTabIds.filter((tabId) => tabById.has(tabId)),
    ...tabs.map((tab) => tab.id).filter((tabId) => !orderedIdSet.has(tabId)),
  ]
  const orderedTabs = visibleTabIds
    .map((tabId) => tabById.get(tabId))
    .filter((tab): tab is BrowserTabState => tab !== undefined)

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

  return (
    <div aria-label="Browser tabs" className="photon-tab-strip" role="tablist">
      <div className="photon-tab-reorder-group">
        {orderedTabs.map((tab) => (
          <div
            key={tab.id}
            className="photon-tab-layout"
            data-drag-over={dropTargetTabId === tab.id ? "true" : undefined}
            data-dragging={draggedTabId === tab.id ? "true" : undefined}
            data-photon-tab={tab.id}
            draggable
            onDragEnd={handleDragEnd}
            onDragOver={(event) => handleDragOver(event, tab.id)}
            onDragStart={(event) => handleDragStart(event, tab.id)}
            onDrop={(event) => handleDrop(event, tab.id)}
          >
            <BrowserTab tab={tab} />
          </div>
        ))}
      </div>
      <div className="photon-new-tab-layout">
        <IconButton
          ariaLabel="New tab"
          className="photon-new-tab"
          size="sm"
          variant="ghost"
          onPress={() => void window.photon.tabs.create()}
        >
          <Plus aria-hidden="true" size={17} />
        </IconButton>
      </div>
    </div>
  )
}

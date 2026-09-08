import { memo, useEffect, useRef, useState } from "react"
import { Button } from "@heroui/react"
import { Asterisk, Globe2, LoaderCircle, Plus, X } from "lucide-react"
import { AnimatePresence, LayoutGroup, Reorder, motion, useReducedMotion } from "motion/react"
import type { BrowserTab as BrowserTabState, TabId } from "@/preload/photon-api"
import { useBrowserStore } from "../stores/browser-store"

interface BrowserTabProps {
  reducedMotion: boolean
  tab: BrowserTabState
}

function areBrowserTabPropsEqual(previous: BrowserTabProps, next: BrowserTabProps): boolean {
  const previousTab = previous.tab
  const nextTab = next.tab
  return (
    previous.reducedMotion === next.reducedMotion &&
    previousTab.id === nextTab.id &&
    previousTab.url === nextTab.url &&
    previousTab.title === nextTab.title &&
    previousTab.faviconUrl === nextTab.faviconUrl &&
    previousTab.loading === nextTab.loading &&
    previousTab.canGoBack === nextTab.canGoBack &&
    previousTab.canGoForward === nextTab.canGoForward
  )
}

function hasSameTabOrder(first: readonly TabId[], second: readonly TabId[]): boolean {
  return first.length === second.length && first.every((tabId, index) => tabId === second[index])
}

const tabMotionTransition = {
  layout: {
    duration: 0.15,
    ease: [0.22, 1, 0.36, 1],
  },
  opacity: {
    duration: 0.08,
    ease: "easeOut",
  },
  scale: {
    duration: 0.15,
    ease: [0.22, 1, 0.36, 1],
  },
} as const

const BrowserTab = memo(function BrowserTab({
  reducedMotion,
  tab,
}: BrowserTabProps): React.JSX.Element {
  const isActive = useBrowserStore((state) => state.activeTabId === tab.id)
  const transition = reducedMotion ? { duration: 0 } : tabMotionTransition

  return (
    <div
      aria-selected={isActive}
      className={isActive ? "photon-tab photon-tab-active" : "photon-tab"}
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
      {isActive && (
        <motion.span
          aria-hidden="true"
          className="photon-tab-active-background"
          layoutId="photon-active-tab"
          transition={transition}
        />
      )}
      <span className="photon-tab-content">
        <span className="photon-tab-icon">
          {tab.loading ? (
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
        <button
          aria-label="Close tab"
          className="photon-tab-close"
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            void window.photon.tabs.close(tab.id)
          }}
        >
          <X size={14} />
        </button>
      </span>
    </div>
  )
}, areBrowserTabPropsEqual)

export function TabStrip(): React.JSX.Element {
  const tabs = useBrowserStore((state) => state.tabs)
  const reducedMotion = useReducedMotion() ?? false
  const transition = reducedMotion ? { duration: 0 } : tabMotionTransition
  const [orderedTabIds, setOrderedTabIds] = useState<TabId[]>(() => tabs.map((tab) => tab.id))
  const orderedTabIdsRef = useRef(orderedTabIds)
  const pendingOrderRef = useRef<TabId[] | null>(null)
  const tabsRef = useRef(tabs)

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

  return (
    <div aria-label="Browser tabs" className="photon-tab-strip" role="tablist">
      <Reorder.Group
        as="div"
        axis="x"
        className="photon-tab-reorder-group"
        values={orderedTabs.map((tab) => tab.id)}
        onReorder={handleReorder}
      >
        <LayoutGroup id="photon-tabs">
          <AnimatePresence initial={false} mode="popLayout">
            {orderedTabs.map((tab) => (
              <Reorder.Item
                key={tab.id}
                as="div"
                className="photon-tab-layout"
                data-photon-tab={tab.id}
                layout
                transition={transition}
                value={tab.id}
                whileDrag={{ scale: 1.02, zIndex: 2 }}
                onDragEnd={commitReorder}
              >
                <BrowserTab reducedMotion={reducedMotion} tab={tab} />
              </Reorder.Item>
            ))}
          </AnimatePresence>
        </LayoutGroup>
      </Reorder.Group>
      <div className="photon-new-tab-layout">
        <Button
          isIconOnly
          aria-label="New tab"
          className="photon-new-tab"
          size="sm"
          variant="ghost"
          onPress={() => void window.photon.tabs.create()}
        >
          <Plus size={17} />
        </Button>
      </div>
    </div>
  )
}

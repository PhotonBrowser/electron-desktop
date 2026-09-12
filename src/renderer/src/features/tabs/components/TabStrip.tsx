import { Plus } from "lucide-react"
import { IconButton } from "@/renderer/src/ui/IconButton"
import { useBrowserStore } from "@/renderer/src/stores/browser-store"
import { Tab } from "./Tab"
import { useTabReordering } from "../hooks/useTabReordering"

export function TabStrip(): React.JSX.Element {
  const tabs = useBrowserStore((state) => state.tabs)
  const {
    orderedTabs,
    draggedTabId,
    dropTargetTabId,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
  } = useTabReordering(tabs)

  return (
    <div aria-label="Browser tabs" className="photon-tab-strip" role="tablist">
      <div className="photon-tab-reorder-group">
        {orderedTabs.map((tab) => (
          <div
            key={tab.id}
            className="photon-tab-layout z-10"
            data-drag-over={dropTargetTabId === tab.id ? "true" : undefined}
            data-dragging={draggedTabId === tab.id ? "true" : undefined}
            data-photon-tab={tab.id}
            draggable
            onDragEnd={handleDragEnd}
            onDragOver={(event) => handleDragOver(event, tab.id)}
            onDragStart={(event) => handleDragStart(event, tab.id)}
            onDrop={(event) => handleDrop(event, tab.id)}
          >
            <Tab tab={tab} />
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
          <Plus aria-hidden="true" size={15} />
        </IconButton>
      </div>
    </div>
  )
}

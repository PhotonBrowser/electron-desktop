import { ArrowLeft, ArrowRight, RotateCw, X } from "lucide-react"
import { IconButton } from "@/renderer/src/ui/IconButton"
import { useActiveTab } from "../../browser/hooks/useActiveTab"

export function NavigationControls(): React.JSX.Element {
  const activeTab = useActiveTab()
  const isLoading = activeTab?.loading === true

  return (
    <div className="photon-navigation-controls">
      <IconButton
        ariaLabel="Back"
        className="photon-toolbar-button"
        isDisabled={!activeTab?.canGoBack}
        size="sm"
        variant="ghost"
        onPress={() => void window.photon.navigation.back()}
      >
        <ArrowLeft aria-hidden="true" size={19} />
      </IconButton>
      <IconButton
        ariaLabel="Forward"
        className="photon-toolbar-button"
        isDisabled={!activeTab?.canGoForward}
        size="sm"
        variant="ghost"
        onPress={() => void window.photon.navigation.forward()}
      >
        <ArrowRight aria-hidden="true" size={19} />
      </IconButton>
      <IconButton
        ariaLabel={isLoading ? "Stop loading" : "Reload"}
        className="photon-toolbar-button"
        size="sm"
        variant="ghost"
        onPress={() =>
          void (isLoading ? window.photon.navigation.stop() : window.photon.navigation.reload())
        }
      >
        {isLoading ? <X aria-hidden="true" size={19} /> : <RotateCw aria-hidden="true" size={19} />}
      </IconButton>
    </div>
  )
}

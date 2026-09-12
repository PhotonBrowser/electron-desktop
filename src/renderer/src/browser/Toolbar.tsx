import { type RefObject } from "react"
import { BrowserMenu } from "../features/menus/components/BrowserMenu"
import { NavigationControls } from "../features/navigation/components/NavigationControls"
import { Omnibox } from "../features/omnibox/components/Omnibox"
import { DownloadsButton } from "../features/downloads/components/DownloadsButton"
import type { DownloadsState } from "../features/downloads/hooks/useDownloads"

interface ToolbarProps {
  addressInput: RefObject<HTMLInputElement | null>
  downloads: DownloadsState
}

export function Toolbar({ addressInput, downloads }: ToolbarProps): React.JSX.Element {
  return (
    <header className="photon-toolbar">
      <NavigationControls />
      <Omnibox addressInput={addressInput} />
      <DownloadsButton {...downloads} />
      <BrowserMenu />
    </header>
  )
}

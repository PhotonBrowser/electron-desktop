import { type RefObject } from "react"
import { BrowserMenu } from "../features/menus/components/BrowserMenu"
import { NavigationControls } from "../features/navigation/components/NavigationControls"
import { Omnibox } from "../features/omnibox/components/Omnibox"

interface ToolbarProps {
  addressInput: RefObject<HTMLInputElement | null>
}

export function Toolbar({ addressInput }: ToolbarProps): React.JSX.Element {
  return (
    <header className="photon-toolbar">
      <NavigationControls />
      <Omnibox addressInput={addressInput} />
      <BrowserMenu />
    </header>
  )
}

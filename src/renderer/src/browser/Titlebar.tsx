import { TabStrip } from "./TabStrip"
import { WindowControls } from "./WindowControls"

export function Titlebar(): React.JSX.Element {
  const isMac = navigator.platform.startsWith("Mac")

  return (
    <div className={isMac ? "photon-titlebar photon-titlebar-mac" : "photon-titlebar"}>
      <TabStrip />
      <WindowControls />
    </div>
  )
}

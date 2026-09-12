import { AppWindow, EllipsisVertical, Plus, Settings } from "lucide-react"
import { DropDown } from "@/renderer/components/DropDown"

export function BrowserMenu(): React.JSX.Element {
  return (
    <DropDown
      trigger={<EllipsisVertical aria-hidden="true" size={19} />}
      triggerLabel="Browser menu"
      triggerClassName="photon-toolbar-button"
      items={[
        {
          id: "new-tab",
          label: "New tab",
          icon: <Plus size={16} />,
          onClick: () => void window.photon.tabs.create(),
        },
        {
          id: "new-window",
          label: "New window",
          icon: <AppWindow size={16} />,
          onClick: () => void window.photon.window.newWindow(),
        },
        {
          id: "settings",
          label: "Settings",
          icon: <Settings size={16} />,
          onClick: () => {
            void window.photon.tabs
              .create()
              .then(() => window.photon.navigation.navigate("photon-browser://settings"))
          },
        },
      ]}
    />
  )
}

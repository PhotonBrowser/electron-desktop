import type { ReactNode } from "react"
import { SettingCopy } from "./SettingCopy"

interface SettingsSectionProps {
  title: string
  description: string
  titleId: string
  control?: ReactNode
  children?: ReactNode
}

export function SettingsSection({
  title,
  description,
  titleId,
  control,
  children,
}: SettingsSectionProps): React.JSX.Element {
  return (
    <section aria-labelledby={titleId} className="photon-settings-group">
      <div className="photon-settings-group-header">
        <SettingCopy description={description} title={title} titleId={titleId} />
        {control ? <div className="photon-settings-control">{control}</div> : null}
      </div>
      {children}
    </section>
  )
}

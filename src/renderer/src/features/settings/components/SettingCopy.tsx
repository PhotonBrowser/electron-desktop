interface SettingCopyProps {
  title: string
  description: string
  titleId?: string
}

export function SettingCopy({ title, description, titleId }: SettingCopyProps): React.JSX.Element {
  return (
    <div className="photon-settings-copy">
      <h2 id={titleId}>{title}</h2>
      <p>{description}</p>
    </div>
  )
}

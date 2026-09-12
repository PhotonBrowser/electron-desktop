import { Input } from "@heroui/react"
import { Search } from "lucide-react"
import { useState, type FormEvent } from "react"
import photonLogo from "@resources/logo.svg"

export function NewTabPage(): React.JSX.Element {
  const [value, setValue] = useState("")
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    void window.photon.navigation.navigate(value)
  }

  return (
    <main className="photon-viewport photon-new-tab-page">
      <div className="photon-new-tab-content">
        <div className="photon-new-tab-brand">
          <img alt="" className="photon-new-tab-logo" height={40} src={photonLogo} width={40} />
          <h1>Photon</h1>
        </div>
        <form className="photon-new-tab-form" onSubmit={submit}>
          <Search aria-hidden="true" className="photon-new-tab-icon z-10" size={21} />
          <Input
            aria-label="Search or enter address"
            autoComplete="off"
            placeholder="Search or enter address"
            value={value}
            variant="secondary"
            onChange={(event) => setValue(event.target.value)}
          />
        </form>
      </div>
    </main>
  )
}

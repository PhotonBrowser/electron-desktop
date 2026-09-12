import { Modal as HeroModal } from "@heroui/react"
import type { ReactNode } from "react"

export interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
}

/**
 * Photon modal surface. HeroUI/React Aria portals the modal overlay to body,
 * which keeps it independent from local stacking contexts in the chrome DOM.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
}: ModalProps): React.JSX.Element {
  return (
    <HeroModal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <HeroModal.Backdrop
        isDismissable
        className="fixed inset-0 z-50 bg-black/50 opacity-100 transition-opacity duration-300 ease-out data-[closed]:opacity-0 data-[entering]:opacity-0 data-[exiting]:opacity-0 data-[exiting]:duration-200 data-[exiting]:ease-in"
      >
        <HeroModal.Container className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <HeroModal.Dialog className="w-full max-w-md rounded-lg border border-line bg-panel text-fg opacity-100 shadow-elevated transition-[opacity,transform] duration-300 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 data-[entering]:scale-95 data-[entering]:opacity-0 data-[exiting]:scale-95 data-[exiting]:opacity-0 data-[exiting]:duration-200 data-[exiting]:ease-in">
            <HeroModal.Header className="px-5 pt-5">
              <HeroModal.Heading className="text-lg font-semibold">{title}</HeroModal.Heading>
              {description ? <p className="mt-1 text-sm text-fg/70">{description}</p> : null}
            </HeroModal.Header>
            <HeroModal.Body className="px-5 py-4">{children}</HeroModal.Body>
          </HeroModal.Dialog>
        </HeroModal.Container>
      </HeroModal.Backdrop>
    </HeroModal>
  )
}

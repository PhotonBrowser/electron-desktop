import { Button } from "@heroui/react"
import { Modal } from "./Modal"

export interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  cancelLabel?: string
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
}: ConfirmDialogProps): React.JSX.Element {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title}>
      <p className="text-sm text-fg/80">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="tertiary" onPress={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant="primary" onPress={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}

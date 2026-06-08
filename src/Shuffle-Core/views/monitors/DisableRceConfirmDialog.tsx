import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { PendingDisableRce } from '@/hooks/useHostActions';

/**
 * Shared "are you 100% sure?" confirm for the irreversible script:disable_rce
 * action. Used wherever HostActionPopover/useHostActions is mounted.
 */
interface DisableRceConfirmDialogProps {
  pending: PendingDisableRce | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export const DisableRceConfirmDialog = ({ pending, onCancel, onConfirm }: DisableRceConfirmDialogProps) => (
  <AlertDialog open={!!pending} onOpenChange={(o) => { if (!o) onCancel(); }}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Disable Remote Code Execution?</AlertDialogTitle>
        <AlertDialogDescription>
          Are you 100% sure? This will disable RCE on <span className="font-mono text-foreground">{pending?.hostname}</span>.
          You will <strong>not</strong> be able to turn it back on without restarting the agent on the host.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          onClick={onConfirm}
        >
          Yes, disable RCE
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default DisableRceConfirmDialog;

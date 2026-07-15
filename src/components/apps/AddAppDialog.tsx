/**
 * Thin host-app wrapper around the `AddAppDialog` / `AddAppButton` exported
 * from Shuffle-Core. Kept as a re-export so existing imports continue to
 * work; new usages should import directly from `@/Shuffle-Core`.
 */
export {
  AddAppDialog,
  AddAppButton,
  type AddAppDialogProps,
  type AddAppButtonProps,
} from '@/Shuffle-Core';

import { AddAppDialog } from '@/Shuffle-Core';
export default AddAppDialog;

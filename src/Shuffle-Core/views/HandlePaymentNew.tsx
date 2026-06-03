// Shim for the legacy `views/HandlePaymentNew.jsx` from Shuffle Core.
// Per project notes: HandlePaymentNew has been replaced by PricingPage.
// We re-export PricingPage as the default and provide the named exports
// (typecost, typecost_single, handlePayasyougo) Billing.tsx imports.
export { default } from './PricingPage';

// Standard Shuffle pay-as-you-go pricing (USD per app run).
export const typecost = 0.001;
export const typecost_single = 0.0008;

// Pay-as-you-go checkout entry point. The full implementation lives in the
// legacy backend; here we just redirect the user to the pricing page so they
// can complete the upgrade flow.
export const handlePayasyougo = (
  _userdata?: unknown,
  _selectedOrganization?: unknown,
  _billingEmail?: unknown
): void => {
  if (typeof window !== 'undefined') {
    window.location.href = '/pricing?billing_cycle=monthly';
  }
};

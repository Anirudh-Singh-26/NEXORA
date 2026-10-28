import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

/** Shown instead of the wallet modal when VITE_REOWN_PROJECT_ID is missing, so a click never silently does nothing. */
export function WalletSetupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="top-[22%] max-w-md">
      <DialogTitle>Wallet connections need setup</DialogTitle>
      <DialogDescription className="mt-2 text-sm leading-6 text-mute">
        This NEXORA build has no wallet project ID, so wallet connection is switched off. Add <code className="font-mono text-ink">VITE_REOWN_PROJECT_ID</code> (a free, public ID from dashboard.reown.com) to <code className="font-mono text-ink">.env.local</code> or your host's environment variables, then restart or redeploy.
      </DialogDescription>
      <p className="mt-3 text-xs text-mute">The rest of NEXORA keeps working without a wallet.</p>
    </DialogContent>
  </Dialog>
}

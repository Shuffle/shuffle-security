import { ArrowRight, PlayCircle, Globe } from 'lucide-react';
import { AgentIcon } from '@shuffleio/shuffle-mcps';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import shuffleInfraLogo from '@/assets/shuffle-infrastructure-logo.png';

interface ProductChoiceStepProps {
  onSelectCore: () => void;
  onSelectSecurity: () => void;
  onStartDemo?: () => void;
}

export const ProductChoiceStep = ({ onSelectCore, onSelectSecurity, onStartDemo }: ProductChoiceStepProps) => {
  return (
    <div className="w-full flex justify-center px-6 py-8">
      <div className="w-full max-w-4xl">
        <div className="mb-12 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-primary">
            Choose how you want to use Shuffle
          </p>
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            What are you here to do?
          </h1>
          <p className="mx-auto max-w-xl text-base text-muted-foreground">
            You always have access to both. Pick the one you want to start with.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={onSelectSecurity}
            className="group flex flex-col rounded-xl border border-border bg-transparent p-6 text-left transition-colors hover:border-primary hover:bg-card/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center">
              <AgentIcon size={40} />
            </div>
            <h2 className="mb-1 text-lg font-semibold text-foreground">
              Incidents and host monitoring
            </h2>
            <p className="mb-4 flex-1 text-sm text-muted-foreground">
              Shuffle Security handles the heavy lifting across incidents, hosts and vulnerabilities. You stay in control, because every automation is a workflow you can inspect and edit.
            </p>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
              Continue with Shuffle Security
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>

          <button
            type="button"
            onClick={onSelectCore}
            className="group flex flex-col rounded-xl border border-border bg-transparent p-6 text-left transition-colors hover:border-primary hover:bg-card/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center">
              <img src={shuffleInfraLogo} alt="Shuffle Core" width={40} height={40} style={{ borderRadius: 6 }} />
            </div>
            <h2 className="mb-1 text-lg font-semibold text-foreground">
              Manual workflow and app building
            </h2>
            <p className="mb-4 flex-1 text-sm text-muted-foreground">
              Shuffle Core. The original Shuffle. Build workflows, integrate 3,000+ apps, run AI agents and automate any process across your stack.
            </p>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
              Continue with Shuffle Core
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        </div>

        {onStartDemo && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={onStartDemo}
              className="group inline-flex h-9 items-center gap-2 rounded-md border border-border bg-transparent px-4 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <PlayCircle className="h-4 w-4" />
              See it immediately — Try Demo Mode
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        )}

        <div className="mt-6 flex flex-col items-center gap-2">
          <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Region
          </label>
          <Select value="eu" disabled>
            <SelectTrigger className="h-9 w-[260px]">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="eu">Europe — shuffler.io</SelectItem>
              <SelectItem value="us">United States — us.shuffler.io</SelectItem>
              <SelectItem value="ca">Canada — ca.shuffler.io</SelectItem>
              <SelectItem value="onprem">Self-hosted / On-prem</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Region switching is coming soon.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProductChoiceStep;

import { ArrowRight } from 'lucide-react';
import AgentIcon from '@/Shuffle-MCPs/AgentIcon';
import shuffleInfraLogo from '@/assets/shuffle-infrastructure-logo.png';

interface ProductChoiceStepProps {
  onSelectCore: () => void;
  onSelectSecurity: () => void;
}

export const ProductChoiceStep = ({ onSelectCore, onSelectSecurity }: ProductChoiceStepProps) => {
  return (
    <div className="w-full flex justify-center px-6 py-8">
      <div className="w-full max-w-4xl">
        <div className="mb-12 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-primary">
            Welcome to Shuffle
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
            className="group flex flex-col rounded-xl border border-transparent bg-card p-6 text-left transition-colors hover:border-primary hover:bg-card/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center">
              <AgentIcon size={40} />
            </div>
            <h2 className="mb-1 text-lg font-semibold text-foreground">
              Do you want incidents and host monitoring?
            </h2>
            <p className="mb-4 flex-1 text-sm text-muted-foreground">
              Shuffle Security. A modern SOC platform. Connect data sources, enrich alerts, manage incidents and let AI agents do the heavy lifting.
            </p>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
              Continue with Shuffle Security
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>

          <button
            type="button"
            onClick={onSelectCore}
            className="group flex flex-col rounded-xl border border-transparent bg-card p-6 text-left transition-colors hover:border-primary hover:bg-card/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center">
              <img src={shuffleInfraLogo} alt="Shuffle Core" width={40} height={40} style={{ borderRadius: 6 }} />
            </div>
            <h2 className="mb-1 text-lg font-semibold text-foreground">
              Do you want manual workflow and app building?
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
      </div>
    </div>
  );
};

export default ProductChoiceStep;

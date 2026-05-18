import { Lock } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useIsSupport } from '@/hooks/useIsSupport';
import { cn } from '@/lib/utils';

export type RegionCode = 'us' | 'eu2' | 'ca' | 'uk' | 'aus';

export const REGION_OPTIONS: { value: RegionCode; label: string; flag: string; url: string }[] = [
  { value: 'uk', label: 'UK', flag: '🇬🇧', url: 'shuffler.io' },
  { value: 'us', label: 'US', flag: '🇺🇸', url: 'us.shuffler.io' },
  { value: 'eu2', label: 'EU-2', flag: '🇪🇺', url: 'eu2.shuffler.io' },
  { value: 'ca', label: 'CA', flag: '🇨🇦', url: 'ca.shuffler.io' },
  { value: 'aus', label: 'AUS (test)', flag: '🇦🇺', url: 'aus.shuffler.io' },
];

interface RegionSwitcherProps {
  value?: RegionCode;
  onChange?: (value: RegionCode) => void;
  /** Force disabled regardless of support status */
  forceDisabled?: boolean;
  showLabel?: boolean;
  className?: string;
  triggerClassName?: string;
}

export const RegionSwitcher = ({
  value = 'uk',
  onChange,
  forceDisabled = false,
  showLabel = true,
  className,
  triggerClassName,
}: RegionSwitcherProps) => {
  const isSupport = useIsSupport();
  const disabled = forceDisabled || !isSupport;
  

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <Select value={value} onValueChange={(v) => onChange?.(v as RegionCode)} disabled={disabled}>
        <SelectTrigger className={cn('h-9 w-[220px]', triggerClassName)}>
          {showLabel && (
            <span className="mr-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Region
            </span>
          )}
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {REGION_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              <span className="flex items-center gap-2">
                <span className="text-base leading-none">{opt.flag}</span>
                <span>{opt.label}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {disabled && (
        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          Region switching is restricted to Shuffle support.
        </p>
      )}
    </div>
  );
};

export default RegionSwitcher;

"use client";

import { useMemo, useState } from "react";
import { 
  Smartphone, 
  Wifi, 
  ArrowLeft, 
  CheckCircle2,
  Loader2,
  Phone,
} from "lucide-react";
import { formatCurrency, type Currency } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { useSettings } from "@/hooks/use-settings";
import { AIRTIME_NETWORKS } from "@/lib/bills/networks";

const BILL_CATEGORIES = [
  {
    id: "airtime",
    name: "Airtime",
    icon: Smartphone,
    color: "from-blue-500 to-blue-600",
  },
  {
    id: "data",
    name: "Data",
    icon: Wifi,
    color: "from-purple-500 to-purple-600",
  },
];

const AIRTIME_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];
const DATA_PLANS = [
  { name: "500MB", amount: 200, validity: "30 days" },
  { name: "1GB", amount: 350, validity: "30 days" },
  { name: "2GB", amount: 600, validity: "30 days" },
  { name: "5GB", amount: 1200, validity: "30 days" },
  { name: "10GB", amount: 2000, validity: "30 days" },
];

interface BillsPurchasePayload {
  category: string;
  phoneNumber: string;
  amount: number;
  networkCode?: string;
  networkName?: string;
  bonusType?: string | null;
}

interface BillsTabProps {
  balance: number;
  currency: Currency;
  onPurchase: (payload: BillsPurchasePayload) => Promise<void>;
}

function ProviderBadge({
  label,
  enabled,
}: {
  label: string;
  enabled: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
        enabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
      }`}
    >
      {enabled ? 'Active Provider' : 'Provider Disabled'}
      <span className="uppercase tracking-wide">{label}</span>
    </span>
  );
}

export function BillsTab({ balance, currency, onPurchase }: BillsTabProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<typeof DATA_PLANS[0] | null>(null);
  const [selectedNetworkId, setSelectedNetworkId] = useState<string | null>(null);
  const [selectedBonusType, setSelectedBonusType] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();
  const { getBillsLimits } = useSettings();
  const billsLimits = getBillsLimits();

  const {
    billsEnabled,
    airtimeEnabled,
    minAirtimeAmount,
    maxAirtimeAmount,
    allowedNetworkCodes,
    defaultProvider,
    enabledProviders,
  } = billsLimits;

  const selectedCategoryData = BILL_CATEGORIES.find((c) => c.id === selectedCategory);
  const availableNetworks = useMemo(() => {
    if (allowedNetworkCodes?.length) {
      return AIRTIME_NETWORKS.filter((network) => allowedNetworkCodes.includes(network.code));
    }
    return AIRTIME_NETWORKS;
  }, [allowedNetworkCodes]);
  const selectedNetwork =
    availableNetworks.find((network) => network.id === selectedNetworkId) || null;
  const providerLabel = defaultProvider ? defaultProvider.toUpperCase() : 'PROVIDER';
  const providerActive = enabledProviders?.includes(defaultProvider);

  const resetForm = () => {
    setSelectedCategory(null);
    setPhoneNumber("");
    setSelectedAmount(null);
    setSelectedPlan(null);
    setSelectedNetworkId(null);
    setSelectedBonusType(null);
    setCustomAmount("");
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSelectedAmount(null);
    setSelectedPlan(null);
    setSelectedNetworkId(null);
    setSelectedBonusType(null);
    setCustomAmount("");
  };

  const handleAmountSelect = (amount: number) => {
    if (balance < amount) {
      toast({
        title: "Insufficient balance",
        description: `You need ${formatCurrency(amount, currency)} but only have ${formatCurrency(balance, currency)}`,
        variant: "destructive",
      });
      return;
    }
    setSelectedAmount(amount);
    setCustomAmount("");
  };

  const handlePlanSelect = (plan: typeof DATA_PLANS[0]) => {
    if (balance < plan.amount) {
      toast({
        title: "Insufficient balance",
        description: `You need ${formatCurrency(plan.amount, currency)} but only have ${formatCurrency(balance, currency)}`,
        variant: "destructive",
      });
      return;
    }
    setSelectedPlan(plan);
    setSelectedAmount(plan.amount);
    setCustomAmount("");
  };

  const handlePurchase = async () => {
    if (selectedCategory === 'data') {
      toast({
        title: "Coming soon",
        description: "Data bundle purchases will be available shortly.",
      });
      return;
    }

    if (!selectedCategory || !phoneNumber.trim() || !selectedAmount || selectedAmount <= 0) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (selectedCategory === 'airtime' && !selectedNetwork) {
      toast({
        title: "Select a network",
        description: "Choose a mobile network to continue.",
        variant: "destructive",
      });
      return;
    }

    if (selectedAmount < minAirtimeAmount || selectedAmount > maxAirtimeAmount) {
      toast({
        title: "Amount not allowed",
        description: `Airtime purchases must be between ₦${minAirtimeAmount.toLocaleString()} and ₦${maxAirtimeAmount.toLocaleString()}.`,
        variant: "destructive",
      });
      return;
    }

    if (balance < selectedAmount) {
      toast({
        title: "Insufficient balance",
        description: "You don't have enough funds",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      await onPurchase({
        category: selectedCategory,
        phoneNumber,
        amount: selectedAmount,
        networkCode: selectedNetwork?.code,
        networkName: selectedNetwork?.name,
        bonusType: selectedBonusType,
      });

      resetForm();
    } catch {
      // Parent handles error feedback
    } finally {
      setProcessing(false);
    }
  };

  const handleCustomAmountChange = (value: string) => {
    const numeric = value.replace(/[^\d]/g, '');
    if (!numeric) {
      setCustomAmount('');
      setSelectedAmount(null);
      setSelectedPlan(null);
      return;
    }

    const parsed = parseInt(numeric, 10);
    setCustomAmount(parsed.toString());
    setSelectedAmount(parsed);
    setSelectedPlan(null);
  };

  if (!billsEnabled) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-center space-y-1.5">
          <p className="text-sm font-semibold">Bills are currently disabled</p>
          <p className="text-xs text-muted-foreground">Please check back later.</p>
        </CardContent>
      </Card>
    );
  }

  if (!selectedCategory) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-center gap-3">
          {BILL_CATEGORIES.map((category) => {
            const Icon = category.icon;
            const isDisabled =
              category.id === 'airtime' ? !airtimeEnabled : false;
            return (
              <button
                key={category.id}
                onClick={() => !isDisabled && handleCategorySelect(category.id)}
                disabled={isDisabled}
                className={`group relative flex flex-col items-center gap-1.5 p-3 rounded-lg transition-all duration-200 touch-manipulation ${
                  isDisabled
                    ? 'bg-muted/50 opacity-60 cursor-not-allowed'
                    : 'hover:bg-muted/50 active:scale-95'
                }`}
              >
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${category.color} flex items-center justify-center shadow-md group-hover:scale-105 transition-all duration-200`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-xs font-semibold">{category.name}</span>
                {isDisabled && (
                  <span className="text-[10px] text-muted-foreground">Disabled</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with back button */}
      <div className="flex items-center gap-2">
        <button
          onClick={resetForm}
          className="flex items-center justify-center w-8 h-8 rounded-md border border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 active:scale-95"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-2">
          {selectedCategoryData && (
            <>
              <div className={`w-7 h-7 rounded-md bg-gradient-to-br ${selectedCategoryData.color} flex items-center justify-center`}>
                {selectedCategoryData.icon && <selectedCategoryData.icon className="h-3.5 w-3.5 text-white" />}
              </div>
              <h3 className="text-sm font-bold">{selectedCategoryData.name}</h3>
            </>
          )}
        </div>
      </div>

      {/* Phone Number Input */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-medium text-foreground">Phone Number</label>
          <ProviderBadge label={providerLabel} enabled={Boolean(providerActive)} />
        </div>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
            placeholder="08012345678"
            className="w-full pl-9 pr-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            maxLength={11}
            disabled={processing}
          />
        </div>
      </div>

      {/* Network Selection */}
      {selectedCategory === 'airtime' && availableNetworks.length > 0 && (
        <div>
          <label className="block text-xs font-medium mb-2">Select Network</label>
          <div className="grid grid-cols-2 gap-2">
            {availableNetworks.map((network) => {
              const isSelected = selectedNetworkId === network.id;
              return (
                <button
                  key={network.id}
                  onClick={() => {
                    setSelectedNetworkId(network.id);
                    setSelectedBonusType(null);
                  }}
                  disabled={processing}
                  className={`flex items-center gap-2 p-2 rounded-md border transition-all duration-200 ${
                    isSelected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-md bg-gradient-to-br ${network.gradient} flex items-center justify-center text-[11px] font-bold text-white uppercase`}>
                    {network.name.slice(0, 2)}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold">{network.name}</p>
                    <p className="text-[11px] text-muted-foreground uppercase">Code {network.code}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedCategory === 'airtime' && availableNetworks.length === 0 && (
        <Card className="border border-dashed">
          <CardContent className="py-4 text-center space-y-1">
            <p className="text-sm font-semibold">No networks configured</p>
            <p className="text-xs text-muted-foreground">
              Please ask an admin to enable at least one airtime network.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Bonus Selection */}
      {selectedCategory === 'airtime' && selectedNetwork?.bonusTypes?.length ? (
        <div>
          <label className="block text-xs font-medium mb-2">Bonus (Optional)</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedBonusType(null)}
              className={`px-3 py-1.5 rounded-md border text-xs ${
                selectedBonusType === null
                  ? 'border-primary bg-primary/10 text-primary font-semibold'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              No Bonus
            </button>
            {selectedNetwork.bonusTypes.map((bonus) => (
              <button
                key={bonus.code}
                type="button"
                onClick={() => setSelectedBonusType(bonus.code)}
                className={`px-3 py-1.5 rounded-md border text-xs ${
                  selectedBonusType === bonus.code
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                {bonus.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Amount/Plan Selection */}
      {selectedCategory === 'airtime' && (
        <div>
          <label className="block text-xs font-medium mb-2">Select Amount</label>
          <div className="grid grid-cols-3 gap-2">
            {AIRTIME_AMOUNTS.map((amount) => {
              const isSelected = selectedAmount === amount;
              const isDisabled = balance < amount;
              return (
                <button
                  key={amount}
                  onClick={() => handleAmountSelect(amount)}
                  disabled={isDisabled}
                  className={`p-2 rounded-md border-2 transition-all duration-200 active:scale-95 touch-manipulation ${
                    isSelected
                      ? 'border-primary bg-primary/10 font-semibold'
                      : isDisabled
                      ? 'border-border opacity-40 cursor-not-allowed'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className={`text-xs ${isSelected ? 'text-primary' : ''}`}>
                    {formatCurrency(amount, currency)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedCategory === 'data' && (
        <Card className="border-dashed">
          <CardContent className="p-3 text-center">
            <p className="text-xs font-medium">Data bundles coming soon</p>
            <p className="text-[11px] text-muted-foreground">Stay tuned while we finalize integrations.</p>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {selectedAmount && (
        <div className="p-3 bg-muted/50 rounded-md space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Amount</span>
            <span className="font-semibold">{formatCurrency(selectedAmount, currency)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Balance</span>
            <span>{formatCurrency(balance, currency)}</span>
          </div>
          <div className="pt-1.5 border-t border-border flex items-center justify-between">
            <span className="font-semibold text-xs">Remaining</span>
            <span className="font-bold text-sm text-primary">
              {formatCurrency(balance - selectedAmount, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground/80 pt-1">
            <span>Provider</span>
            <span className="font-medium uppercase">{providerLabel}</span>
          </div>
          <p className="text-[11px] text-muted-foreground/80">
            Limits: ₦{minAirtimeAmount.toLocaleString()} — ₦{maxAirtimeAmount.toLocaleString()}
          </p>
        </div>
      )}

      {/* Purchase Button */}
      <button
        onClick={handlePurchase}
        disabled={
          !phoneNumber.trim() ||
          !selectedAmount ||
          selectedAmount <= 0 ||
          processing ||
          balance < selectedAmount
        }
        className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98] touch-manipulation flex items-center justify-center gap-2 min-h-[40px] focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
      >
        {processing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Complete Purchase
          </>
        )}
      </button>
    </div>
  );
}

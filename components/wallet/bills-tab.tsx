"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
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
import type { DataPlan } from "@/lib/bills/types";

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

interface BillsPurchasePayload {
  category: string;
  phoneNumber: string;
  amount: number;
  networkCode?: string;
  networkName?: string;
  bonusType?: string | null;
   dataPlanCode?: string;
   dataPlanLabel?: string;
}

interface BillsTabProps {
  balance: number;
  currency: Currency;
  onPurchase: (payload: BillsPurchasePayload) => Promise<void>;
}

export function BillsTab({ balance, currency, onPurchase }: BillsTabProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [selectedNetworkId, setSelectedNetworkId] = useState<string | null>(null);
  const [selectedBonusType, setSelectedBonusType] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [selectedDataPlan, setSelectedDataPlan] = useState<DataPlan | null>(null);
  const [dataPlans, setDataPlans] = useState<DataPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planSearch, setPlanSearch] = useState("");
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();
  const { getBillsLimits } = useSettings();
  const billsLimits = getBillsLimits();

  const {
    billsEnabled,
    airtimeEnabled,
    dataEnabled,
    minAirtimeAmount,
    maxAirtimeAmount,
    minDataAmount,
    maxDataAmount,
    allowedNetworkCodes,
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

  const fetchDataPlansFromApi = useCallback(
    async (networkCode: string) => {
      setLoadingPlans(true);
      setPlanError(null);
      setDataPlans([]);
      setSelectedDataPlan(null);
      try {
        const response = await fetch(`/api/bills/data/plans?networkCode=${networkCode}`);
        const result = await response.json();
        if (!response.ok || !result?.success) {
          const message =
            result?.error?.message || 'Failed to load data plans. Please try again.';
          throw new Error(message);
        }
        const plans = result.data?.plans || [];
        setDataPlans(plans);
        if (plans.length === 0) {
          setPlanError('No data plans available for this network yet.');
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to load data plans.';
        setPlanError(message);
        setDataPlans([]);
        toast({
          title: 'Unable to load data plans',
          description: message,
          variant: 'destructive',
        });
      } finally {
        setLoadingPlans(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (selectedCategory === 'data' && selectedNetwork?.code) {
      setSelectedAmount(null);
      fetchDataPlansFromApi(selectedNetwork.code);
    } else {
      setDataPlans([]);
      setSelectedDataPlan(null);
      setPlanSearch("");
      setPlanError(null);
      if (selectedCategory !== 'airtime') {
        setSelectedAmount(null);
      }
      setLoadingPlans(false);
    }
  }, [selectedCategory, selectedNetwork, fetchDataPlansFromApi]);

  const filteredPlans = useMemo(() => {
    if (!planSearch.trim()) {
      return dataPlans;
    }
    const query = planSearch.trim().toLowerCase();
    return dataPlans.filter(
      (plan) =>
        plan.label.toLowerCase().includes(query) ||
        plan.description?.toLowerCase().includes(query) ||
        plan.code.toLowerCase().includes(query),
    );
  }, [dataPlans, planSearch]);
  const resetForm = () => {
    setSelectedCategory(null);
    setPhoneNumber("");
    setSelectedAmount(null);
    setSelectedNetworkId(null);
    setSelectedBonusType(null);
    setCustomAmount("");
    setSelectedDataPlan(null);
    setDataPlans([]);
    setPlanSearch("");
    setPlanError(null);
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSelectedAmount(null);
    setSelectedNetworkId(null);
    setSelectedBonusType(null);
    setCustomAmount("");
    setSelectedDataPlan(null);
    setDataPlans([]);
    setPlanSearch("");
    setPlanError(null);
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

  const handlePurchase = async () => {
    if (!selectedCategory || !phoneNumber.trim() || !selectedAmount || selectedAmount <= 0) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (!selectedNetwork) {
      toast({
        title: "Select a network",
        description: "Choose a mobile network to continue.",
        variant: "destructive",
      });
      return;
    }

    const minAllowed =
      selectedCategory === 'data' ? minDataAmount : minAirtimeAmount;
    const maxAllowed =
      selectedCategory === 'data' ? maxDataAmount : maxAirtimeAmount;

    if (selectedAmount < minAllowed || selectedAmount > maxAllowed) {
      toast({
        title: "Amount not allowed",
        description: `This purchase must be between ₦${minAllowed.toLocaleString()} and ₦${maxAllowed.toLocaleString()}.`,
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

    if (selectedCategory === 'data' && !selectedDataPlan) {
      toast({
        title: "Select a data plan",
        description: "Choose a plan to continue.",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    const payload: BillsPurchasePayload =
      selectedCategory === 'data'
        ? {
            category: 'data',
            phoneNumber,
            amount: selectedAmount,
            networkCode: selectedNetwork.code,
            networkName: selectedNetwork.name,
            dataPlanCode: selectedDataPlan?.code,
            dataPlanLabel: selectedDataPlan?.label,
          }
        : {
            category: 'airtime',
            phoneNumber,
            amount: selectedAmount,
            networkCode: selectedNetwork.code,
            networkName: selectedNetwork.name,
            bonusType: selectedBonusType,
          };

    try {
      await onPurchase(payload);
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
      setSelectedDataPlan(null);
      return;
    }

    const parsed = parseInt(numeric, 10);
    setCustomAmount(parsed.toString());
    setSelectedAmount(parsed);
    setSelectedDataPlan(null);
  };

  const handleSelectDataPlan = (plan: DataPlan) => {
    if (balance < plan.price) {
      toast({
        title: "Insufficient balance",
        description: `You need ${formatCurrency(plan.price, currency)} but only have ${formatCurrency(balance, currency)}`,
        variant: "destructive",
      });
      return;
    }
    setSelectedDataPlan(plan);
    setSelectedAmount(plan.price);
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
              category.id === 'airtime'
                ? !airtimeEnabled
                : category.id === 'data'
                ? !dataEnabled
                : false;
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
        <label className="block text-xs font-medium text-foreground mb-1.5">Phone Number</label>
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

      {/* Data Plans */}
      {selectedCategory === 'data' && (
        <div className="space-y-2">
          {selectedNetwork ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <label className="block text-xs font-medium">Data Plans</label>
                <input
                  type="text"
                  value={planSearch}
                  onChange={(e) => setPlanSearch(e.target.value)}
                  placeholder="Search plans"
                  className="w-48 px-2 py-1.5 text-xs border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                  disabled={loadingPlans}
                />
              </div>
              {planError && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">{planError}</p>
              )}
              {loadingPlans ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredPlans.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-4 text-center text-xs text-muted-foreground">
                    {planError || 'No plans available yet for this network.'}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {filteredPlans.map((plan) => {
                    const isSelected = selectedDataPlan?.code === plan.code;
                    return (
                      <button
                        key={`${plan.code}-${plan.label}`}
                        type="button"
                        onClick={() => handleSelectDataPlan(plan)}
                        className={`w-full text-left p-3 rounded-md border transition ${
                          isSelected ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{plan.label}</p>
                            {plan.description && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">{plan.description}</p>
                            )}
                            <p className="text-[10px] text-muted-foreground uppercase mt-1">
                              Code: {plan.code}
                            </p>
                          </div>
                          <p className="text-sm font-bold whitespace-nowrap">
                            {formatCurrency(plan.price, currency)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-3 text-center text-xs text-muted-foreground">
                Select a network to view available data plans.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Amount Selection */}
      {selectedCategory === 'airtime' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium">Select Amount</label>
            <span className="text-[11px] text-muted-foreground">
              ₦{minAirtimeAmount.toLocaleString()} – ₦{maxAirtimeAmount.toLocaleString()}
            </span>
          </div>
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
          <div className="relative">
            <input
              type="number"
              min={minAirtimeAmount}
              max={maxAirtimeAmount}
              value={customAmount}
              onChange={(e) => handleCustomAmountChange(e.target.value)}
              placeholder="Or enter custom amount"
              className="w-full px-3 py-2 pr-12 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
              disabled={processing}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
              NGN
            </span>
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
          {selectedCategory === 'data' && selectedDataPlan && (
            <div className="text-[11px] text-muted-foreground/80">
              <span className="font-semibold">Plan:</span> {selectedDataPlan.label}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground/80">
            Limits: ₦
            {(
              (selectedCategory === 'data' ? minDataAmount : minAirtimeAmount) ?? 0
            ).toLocaleString()} — ₦
            {(
              (selectedCategory === 'data' ? maxDataAmount : maxAirtimeAmount) ?? 0
            ).toLocaleString()}
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

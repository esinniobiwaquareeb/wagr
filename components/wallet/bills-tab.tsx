"use client";

import { useState } from "react";
import { 
  Smartphone, 
  Wifi, 
  ArrowLeft, 
  CheckCircle2,
  Loader2,
  Phone,
  Sparkles,
} from "lucide-react";
import { formatCurrency, type Currency } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";

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

interface BillsTabProps {
  balance: number;
  currency: Currency;
  onPurchase: (category: string, phoneNumber: string, amount: number) => Promise<void>;
}

export function BillsTab({ balance, currency, onPurchase }: BillsTabProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<typeof DATA_PLANS[0] | null>(null);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const selectedCategoryData = BILL_CATEGORIES.find(c => c.id === selectedCategory);

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
      await onPurchase(selectedCategory, phoneNumber, selectedAmount);
      
      // Reset form
      setSelectedCategory(null);
      setPhoneNumber("");
      setSelectedAmount(null);
      setSelectedPlan(null);
    } catch (error) {
      // Error handling is done in parent
    } finally {
      setProcessing(false);
    }
  };

  if (!selectedCategory) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-center gap-3">
          {BILL_CATEGORIES.map((category) => {
            const Icon = category.icon;
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className="group relative flex flex-col items-center gap-1.5 p-3 rounded-lg hover:bg-muted/50 transition-all duration-200 active:scale-95 touch-manipulation"
              >
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${category.color} flex items-center justify-center shadow-md group-hover:scale-105 transition-all duration-200`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-xs font-semibold">{category.name}</span>
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
          onClick={() => {
            setSelectedCategory(null);
            setPhoneNumber("");
            setSelectedAmount(null);
            setSelectedPlan(null);
          }}
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
        <label className="block text-xs font-medium mb-1.5 text-foreground">Phone Number</label>
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
        <div>
          <label className="block text-xs font-medium mb-2">Select Data Plan</label>
          <div className="space-y-1.5">
            {DATA_PLANS.map((plan) => {
              const isSelected = selectedPlan?.name === plan.name;
              const isDisabled = balance < plan.amount;
              return (
                <button
                  key={plan.name}
                  onClick={() => handlePlanSelect(plan)}
                  disabled={isDisabled}
                  className={`w-full p-2.5 rounded-md border-2 transition-all duration-200 active:scale-[0.98] touch-manipulation text-left ${
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : isDisabled
                      ? 'border-border opacity-40 cursor-not-allowed'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`font-semibold text-xs ${isSelected ? 'text-primary' : ''}`}>
                        {plan.name}
                      </div>
                      <div className="text-xs text-muted-foreground">{plan.validity}</div>
                    </div>
                    <div className={`font-bold text-xs ${isSelected ? 'text-primary' : ''}`}>
                      {formatCurrency(plan.amount, currency)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
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
        </div>
      )}

      {/* Purchase Button */}
      <button
        onClick={handlePurchase}
        disabled={!phoneNumber.trim() || !selectedAmount || selectedAmount <= 0 || processing || balance < selectedAmount}
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

"use client";

import { useState } from "react";
import { 
  Smartphone, 
  Wifi, 
  Zap, 
  Home, 
  CreditCard, 
  ArrowLeft, 
  CheckCircle2,
  Loader2,
  Phone,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { formatCurrency, type Currency } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";

const BILL_CATEGORIES = [
  {
    id: "airtime",
    name: "Airtime",
    icon: Smartphone,
    color: "from-blue-500 via-blue-600 to-blue-700",
    bgColor: "bg-blue-50 dark:bg-blue-950/20",
    borderColor: "border-blue-200 dark:border-blue-800",
    description: "Top up your phone",
    popular: true,
  },
  {
    id: "data",
    name: "Data",
    icon: Wifi,
    color: "from-purple-500 via-purple-600 to-purple-700",
    bgColor: "bg-purple-50 dark:bg-purple-950/20",
    borderColor: "border-purple-200 dark:border-purple-800",
    description: "Buy internet data",
    popular: true,
  },
  {
    id: "electricity",
    name: "Electricity",
    icon: Zap,
    color: "from-yellow-500 via-orange-500 to-orange-600",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
    borderColor: "border-yellow-200 dark:border-yellow-800",
    description: "Pay electricity bills",
    popular: false,
  },
  {
    id: "cable",
    name: "Cable TV",
    icon: Home,
    color: "from-green-500 via-emerald-600 to-green-700",
    bgColor: "bg-green-50 dark:bg-green-950/20",
    borderColor: "border-green-200 dark:border-green-800",
    description: "DSTV, GOtv & more",
    popular: false,
  },
  {
    id: "other",
    name: "Other Bills",
    icon: CreditCard,
    color: "from-gray-500 via-gray-600 to-gray-700",
    bgColor: "bg-gray-50 dark:bg-gray-950/20",
    borderColor: "border-gray-200 dark:border-gray-800",
    description: "More bill types",
    popular: false,
  },
];

const AIRTIME_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];
const DATA_PLANS = [
  { name: "500MB", amount: 200, validity: "30 days", popular: false },
  { name: "1GB", amount: 350, validity: "30 days", popular: true },
  { name: "2GB", amount: 600, validity: "30 days", popular: false },
  { name: "5GB", amount: 1200, validity: "30 days", popular: false },
  { name: "10GB", amount: 2000, validity: "30 days", popular: false },
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
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h3 className="text-lg font-bold">What would you like to pay for?</h3>
          <p className="text-sm text-muted-foreground">Choose a service to get started</p>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
          {BILL_CATEGORIES.map((category) => {
            const Icon = category.icon;
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`group relative p-5 md:p-6 bg-card border-2 ${category.borderColor} rounded-2xl hover:border-primary/60 hover:shadow-lg transition-all duration-300 active:scale-[0.97] touch-manipulation text-left overflow-hidden`}
              >
                {/* Background gradient overlay on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${category.color} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                
                {category.popular && (
                  <span className="absolute top-3 right-3 px-2.5 py-1 text-[10px] font-semibold bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-full shadow-sm">
                    Popular
                  </span>
                )}
                
                <div className={`relative w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br ${category.color} flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg`}>
                  <Icon className="h-7 w-7 md:h-8 md:w-8 text-white" />
                </div>
                
                <h4 className="font-bold text-base md:text-lg mb-1.5 group-hover:text-primary transition-colors">
                  {category.name}
                </h4>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {category.description}
                </p>
                
                {/* Arrow indicator */}
                <ChevronRight className="absolute bottom-4 right-4 h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => {
            setSelectedCategory(null);
            setPhoneNumber("");
            setSelectedAmount(null);
            setSelectedPlan(null);
          }}
          className="flex items-center justify-center w-10 h-10 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 active:scale-95"
        >
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <h3 className="text-lg font-bold flex items-center gap-2">
            {selectedCategoryData && (
              <>
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${selectedCategoryData.color} flex items-center justify-center`}>
                  {selectedCategoryData.icon && <selectedCategoryData.icon className="h-4 w-4 text-white" />}
                </div>
                {selectedCategoryData.name}
              </>
            )}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {selectedCategoryData?.description}
          </p>
        </div>
      </div>

      {/* Phone Number Input */}
      <Card className="border-2">
        <CardContent className="p-4 md:p-5">
          <label className="block text-sm font-semibold mb-3">Phone Number</label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <Phone className="h-5 w-5 text-muted-foreground" />
            </div>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder="08012345678"
              className="w-full pl-12 pr-4 py-3.5 border-2 border-input rounded-xl bg-background text-foreground text-base focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              maxLength={11}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2 ml-1">
            Enter 11-digit phone number
          </p>
        </CardContent>
      </Card>

      {/* Amount/Plan Selection */}
      {selectedCategory === 'airtime' && (
        <Card className="border-2">
          <CardContent className="p-4 md:p-5">
            <label className="block text-sm font-semibold mb-4">Select Amount</label>
            <div className="grid grid-cols-3 gap-2.5">
              {AIRTIME_AMOUNTS.map((amount) => {
                const isSelected = selectedAmount === amount;
                const isDisabled = balance < amount;
                return (
                  <button
                    key={amount}
                    onClick={() => handleAmountSelect(amount)}
                    disabled={isDisabled}
                    className={`relative p-4 rounded-xl border-2 transition-all duration-200 active:scale-95 touch-manipulation ${
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-md scale-105'
                        : isDisabled
                        ? 'border-border opacity-40 cursor-not-allowed'
                        : 'border-border hover:border-primary/50 hover:shadow-md hover:bg-primary/5'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
                        <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                    <div className={`text-sm font-bold ${isSelected ? 'text-primary' : ''}`}>
                      {formatCurrency(amount, currency)}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedCategory === 'data' && (
        <Card className="border-2">
          <CardContent className="p-4 md:p-5">
            <label className="block text-sm font-semibold mb-4">Select Data Plan</label>
            <div className="space-y-2.5">
              {DATA_PLANS.map((plan) => {
                const isSelected = selectedPlan?.name === plan.name;
                const isDisabled = balance < plan.amount;
                return (
                  <button
                    key={plan.name}
                    onClick={() => handlePlanSelect(plan)}
                    disabled={isDisabled}
                    className={`relative w-full p-4 rounded-xl border-2 transition-all duration-200 active:scale-[0.98] touch-manipulation text-left ${
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-md'
                        : isDisabled
                        ? 'border-border opacity-40 cursor-not-allowed'
                        : 'border-border hover:border-primary/50 hover:shadow-md hover:bg-primary/5'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
                        <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                    {plan.popular && !isSelected && (
                      <span className="absolute top-3 right-3 px-2 py-0.5 text-[10px] font-semibold bg-primary/10 text-primary rounded-full">
                        Popular
                      </span>
                    )}
                    <div className="flex items-center justify-between pr-8">
                      <div>
                        <div className={`font-bold text-base mb-1 ${isSelected ? 'text-primary' : ''}`}>
                          {plan.name}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          Valid for {plan.validity}
                        </div>
                      </div>
                      <div className={`font-bold text-lg ${isSelected ? 'text-primary' : ''}`}>
                        {formatCurrency(plan.amount, currency)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {(selectedCategory === 'electricity' || selectedCategory === 'cable' || selectedCategory === 'other') && (
        <Card className="border-2">
          <CardContent className="p-4 md:p-5">
            <label className="block text-sm font-semibold mb-3">Enter Amount</label>
            <input
              type="number"
              value={selectedAmount || ''}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value) && value > 0) {
                  setSelectedAmount(value);
                } else {
                  setSelectedAmount(null);
                }
              }}
              placeholder="Enter amount"
              min="1"
              max={balance}
              className="w-full px-4 py-3.5 border-2 border-input rounded-xl bg-background text-foreground text-base focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            />
            <div className="mt-3 p-3 rounded-lg bg-muted/50 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Available Balance</span>
              <span className="text-sm font-semibold">{formatCurrency(balance, currency)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Card */}
      {selectedAmount && (
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-primary/10 to-transparent">
          <CardContent className="p-5 md:p-6">
            <h4 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Purchase Summary
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold text-base">{formatCurrency(selectedAmount, currency)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current Balance</span>
                <span className="font-semibold">{formatCurrency(balance, currency)}</span>
              </div>
              <div className="pt-3 border-t-2 border-border flex items-center justify-between">
                <span className="font-bold">Remaining Balance</span>
                <span className="font-bold text-xl text-primary">
                  {formatCurrency(balance - selectedAmount, currency)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Purchase Button */}
      <button
        onClick={handlePurchase}
        disabled={!phoneNumber.trim() || !selectedAmount || selectedAmount <= 0 || processing || balance < selectedAmount}
        className="w-full px-6 py-4 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-xl font-semibold text-base hover:from-primary/90 hover:to-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.98] touch-manipulation flex items-center justify-center gap-2 shadow-lg hover:shadow-xl disabled:shadow-none"
      >
        {processing ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Processing Purchase...
          </>
        ) : (
          <>
            <CheckCircle2 className="h-5 w-5" />
            Complete Purchase
          </>
        )}
      </button>
    </div>
  );
}

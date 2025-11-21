"use client";

import { Smartphone, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface BillsPromoCardProps {
  onBillsClick: () => void;
}

export function BillsPromoCard({ onBillsClick }: BillsPromoCardProps) {
  return (
    <Card className="mb-4 md:mb-6 border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-primary/10 to-transparent hover:border-primary/40 transition-colors">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/20 rounded-xl flex-shrink-0">
            <Sparkles className="h-6 w-6 md:h-8 md:w-8 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base md:text-lg font-bold mb-1 flex items-center gap-2">
              Pay Bills with Wallet
              <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full font-medium">New</span>
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Buy airtime, data, pay electricity bills, and more directly from your wallet balance. Fast, easy, and convenient!
            </p>
            <button
              onClick={onBillsClick}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition active:scale-95 touch-manipulation font-medium text-sm"
            >
              <Smartphone className="h-4 w-4" />
              Pay Bills Now
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


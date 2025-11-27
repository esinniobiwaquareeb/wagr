"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPatch } from "@/lib/api-client";
import { 
  Settings, 
  Save, 
  Loader2, 
  CreditCard, 
  DollarSign, 
  ToggleLeft, 
  ToggleRight,
  Shield,
  Mail,
  Bell,
  Coins,
  FileText,
  Zap,
  Globe,
  Lock,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Eye,
  EyeOff
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatCurrency, DEFAULT_CURRENCY } from "@/lib/currency";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Setting {
  id: string;
  key: string;
  value: any;
  category: string;
  label: string;
  description?: string;
  data_type: 'boolean' | 'number' | 'string' | 'json' | 'array';
  is_public: boolean;
  requires_restart: boolean;
  updated_at: string;
  updated_by?: string;
}

interface GroupedSettings {
  [category: string]: Setting[];
}

const CATEGORY_CONFIG = {
  payments: {
    icon: CreditCard,
    title: "Payment Settings",
    description: "Configure payment processing, deposits, and withdrawals",
    color: "text-blue-500",
  },
  fees: {
    icon: DollarSign,
    title: "Commission & Fees",
    description: "Manage platform fees and commission rates",
    color: "text-green-500",
  },
  features: {
    icon: ToggleRight,
    title: "Feature Flags",
    description: "Enable or disable platform features",
    color: "text-purple-500",
  },
  wagers: {
    icon: FileText,
    title: "Wager Settings",
    description: "Configure wager creation and management",
    color: "text-orange-500",
  },
  quizzes: {
    icon: FileText,
    title: "Quiz Settings",
    description: "Configure quiz creation and management",
    color: "text-indigo-500",
  },
  security: {
    icon: Shield,
    title: "Security Settings",
    description: "Account security and authentication settings",
    color: "text-red-500",
  },
  email: {
    icon: Mail,
    title: "Email Settings",
    description: "Configure email notifications and provider",
    color: "text-cyan-500",
  },
  notifications: {
    icon: Bell,
    title: "Notification Settings",
    description: "Manage notification preferences",
    color: "text-yellow-500",
  },
  ui: {
    icon: Globe,
    title: "UI/UX Settings",
    description: "User interface and experience settings",
    color: "text-pink-500",
  },
  automation: {
    icon: Zap,
    title: "Automation Settings",
    description: "Automated system configurations",
    color: "text-teal-500",
  },
  currency: {
    icon: Coins,
    title: "Currency Settings",
    description: "Currency and localization settings",
    color: "text-amber-500",
  },
};

export default function AdminSettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [groupedSettings, setGroupedSettings] = useState<GroupedSettings>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [requiresRestart, setRequiresRestart] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("payments");
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiGet<{ settings: Setting[]; grouped: GroupedSettings }>('/admin/settings');
      
      if (response) {
        setSettings(response.settings || []);
        setGroupedSettings(response.grouped || {});
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => {
      const updated = prev.map(s => 
        s.key === key ? { ...s, value } : s
      );
      
      // Update grouped settings
      const newGrouped: GroupedSettings = {};
      updated.forEach(setting => {
        if (!newGrouped[setting.category]) {
          newGrouped[setting.category] = [];
        }
        newGrouped[setting.category].push(setting);
      });
      setGroupedSettings(newGrouped);
      
      // Check if restart is required
      const setting = updated.find(s => s.key === key);
      if (setting?.requires_restart) {
        setRequiresRestart(true);
      }
      
      setHasChanges(true);
      return updated;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Prepare settings for update
      const settingsToUpdate = settings.map(s => ({
        key: s.key,
        value: s.value,
        category: s.category,
        label: s.label,
        description: s.description,
        data_type: s.data_type,
        is_public: s.is_public,
        requires_restart: s.requires_restart,
      }));

      const response = await apiPatch<{ message: string; requiresRestart: boolean }>(
        '/admin/settings',
        { settings: settingsToUpdate }
      );

      if (response) {
        toast({
          title: "Success",
          description: response.message || "Settings saved successfully",
        });
        
        if (response.requiresRestart) {
          setRequiresRestart(true);
        }
        
        setHasChanges(false);
        await fetchSettings();
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const renderSetting = (setting: Setting) => {
    const { key, value, label, description, data_type } = setting;

    switch (data_type) {
      case 'boolean':
        return (
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex-1">
              <Label htmlFor={key} className="text-base font-medium">{label}</Label>
              {description && (
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
              )}
            </div>
            <Switch
              id={key}
              checked={value === true || value === 'true'}
              onCheckedChange={(checked) => updateSetting(key, checked)}
            />
          </div>
        );

      case 'number':
        // Check if it's a currency amount
        const isCurrency = key.includes('amount') || key.includes('deposit') || key.includes('withdrawal') || key.includes('limit') || key.includes('cost');
        // Check if it's a percentage
        const isPercentage = key.includes('percentage') || key.includes('fee') || key.includes('commission');
        // Check if it's a duration/time
        const isDuration = key.includes('duration') || key.includes('interval') || key.includes('ttl');
        
        return (
          <div className="space-y-2">
            <Label htmlFor={key}>{label}</Label>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
            <div className="flex items-center gap-2">
              {isCurrency && (
                <span className="text-muted-foreground">{formatCurrency(0, DEFAULT_CURRENCY).replace('0', '')}</span>
              )}
              {isPercentage && (
                <span className="text-muted-foreground">%</span>
              )}
              <Input
                id={key}
                type="number"
                step={isPercentage ? "0.01" : "1"}
                min="0"
                value={value || 0}
                onChange={(e) => {
                  const numValue = isPercentage 
                    ? parseFloat(e.target.value) || 0 
                    : parseInt(e.target.value) || 0;
                  updateSetting(key, numValue);
                }}
                className={`max-w-xs ${isCurrency || isPercentage ? 'pl-8' : ''}`}
              />
              {isCurrency && (
                <span className="text-sm text-muted-foreground">NGN</span>
              )}
              {isPercentage && key.includes('percentage') && (
                <span className="text-sm text-muted-foreground">
                  ({((value || 0) * 100).toFixed(1)}%)
                </span>
              )}
              {isDuration && key.includes('ttl') && (
                <span className="text-sm text-muted-foreground">ms</span>
              )}
              {isDuration && (key.includes('interval') || key.includes('duration')) && !key.includes('ttl') && (
                <span className="text-sm text-muted-foreground">
                  {key.includes('hours') ? 'hours' : key.includes('minutes') ? 'minutes' : 'days'}
                </span>
              )}
            </div>
          </div>
        );

      case 'string':
        const lowerKey = key.toLowerCase();
        const isSensitive = lowerKey.includes('key') || lowerKey.includes('secret') || lowerKey.includes('password');
        const isRevealed = revealedSecrets[key];
        return (
          <div className="space-y-2">
            <Label htmlFor={key}>{label}</Label>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
            <div className="relative max-w-md">
              <Input
                id={key}
                type={isSensitive && !isRevealed ? "password" : "text"}
                value={value ?? ''}
                onChange={(e) => updateSetting(key, e.target.value)}
                className={isSensitive ? "pr-10" : ""}
                placeholder={isSensitive ? "••••••••" : ""}
              />
              {isSensitive && (
                <button
                  type="button"
                  onClick={() =>
                    setRevealedSecrets((prev) => ({ ...prev, [key]: !prev[key] }))
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                  aria-label={isRevealed ? "Hide value" : "Show value"}
                >
                  {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>
        );

      case 'array':
        return (
          <div className="space-y-2">
            <Label htmlFor={key}>{label}</Label>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
            <Input
              id={key}
              type="text"
              value={Array.isArray(value) ? value.join(', ') : value}
              onChange={(e) => {
                const arrayValue = e.target.value.split(',').map(v => v.trim()).filter(v => v);
                updateSetting(key, arrayValue);
              }}
              className="max-w-md"
              placeholder="Comma-separated values"
            />
          </div>
        );

      default:
        return (
          <div className="space-y-2">
            <Label htmlFor={key}>{label}</Label>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
            <Input
              id={key}
              type="text"
              value={typeof value === 'string' ? value : JSON.stringify(value)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  updateSetting(key, parsed);
                } catch {
                  updateSetting(key, e.target.value);
                }
              }}
              className="max-w-md"
            />
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const categories = Object.keys(groupedSettings).sort();
  const availableTabs = categories.filter(cat => groupedSettings[cat]?.length > 0);

  // If no settings found, show empty state
  if (!loading && settings.length === 0) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Settings className="h-8 w-8" />
              Platform Settings
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage all platform configurations and feature flags
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Settings className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-semibold mb-2">No Settings Found</h3>
              <p className="text-muted-foreground mb-4">
                The platform settings table may not be initialized. Please run the database migration.
              </p>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Run the SQL migration script: <code className="text-xs bg-muted px-2 py-1 rounded">47-create-platform-settings.sql</code>
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Settings className="h-8 w-8" />
            Platform Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage all platform configurations and feature flags
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button
              variant="outline"
              onClick={fetchSettings}
              disabled={saving}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="min-w-[120px]"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Restart Warning */}
      {requiresRestart && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Some settings require a server restart to take effect. Please restart the application after saving.
          </AlertDescription>
        </Alert>
      )}

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 h-auto p-2">
          {availableTabs.map((category) => {
            const config = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG];
            const Icon = config?.icon || Settings;
            const count = groupedSettings[category]?.length || 0;
            
            return (
              <TabsTrigger
                key={category}
                value={category}
                className="flex flex-col items-center gap-2 p-4 h-auto data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <Icon className={`h-5 w-5 ${config?.color || ''}`} />
                <div className="text-center">
                  <div className="font-medium text-sm">{config?.title || category}</div>
                  <div className="text-xs opacity-70">{count} settings</div>
                </div>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Tab Contents */}
        {availableTabs.map((category) => {
          const config = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG];
          const categorySettings = groupedSettings[category] || [];

          return (
            <TabsContent key={category} value={category} className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {config?.icon && <config.icon className={`h-5 w-5 ${config.color}`} />}
                    {config?.title || category}
                  </CardTitle>
                  {config?.description && (
                    <CardDescription>{config.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {categorySettings.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No settings in this category</p>
                    </div>
                  ) : (
                    categorySettings.map((setting) => (
                      <div key={setting.id} className="p-4 border rounded-lg bg-card">
                        {renderSetting(setting)}
                        {setting.requires_restart && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Requires server restart to take effect
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}


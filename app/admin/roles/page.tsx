"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { 
  Shield, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Info, 
  Lock, 
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Loader2,
  HelpCircle,
  Settings2,
  UserCheck,
  UserX
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAdmin } from "@/contexts/admin-context";
import { adminManagementApi } from "@/lib/api-client";
import { ADMIN_ROLES, ADMIN_PERMISSIONS, type AdminPermissionDefinition, type AdminRole } from "@/lib/admin-permissions";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface Admin {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  role: string | null;
  is_active: boolean;
  permissions: string[];
}

export default function AdminRolesPage() {
  const { toast } = useToast();
  const { admin: currentAdmin } = useAdmin();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingAdminId, setUpdatingAdminId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetTargetAdmin, setResetTargetAdmin] = useState<Admin | null>(null);

  const canManageAdmins =
    currentAdmin?.role === "super_admin" || currentAdmin?.permissions?.includes("manage_admins");

  const fetchAdmins = useCallback(async () => {
    if (!canManageAdmins) return;

    try {
      setLoading(true);
      const data = await adminManagementApi.getAll();
      setAdmins(data.admins || []);
    } catch (error) {
      logger.error("Error fetching admins for roles page", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch admins",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [canManageAdmins, toast]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  // Filter and search admins
  const filteredAdmins = useMemo(() => {
    let filtered = admins;

    // Filter by role
    if (roleFilter !== "all") {
      filtered = filtered.filter((admin) => admin.role === roleFilter || (!admin.role && roleFilter === "unassigned"));
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (admin) =>
          admin.email.toLowerCase().includes(query) ||
          admin.username?.toLowerCase().includes(query) ||
          admin.full_name?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [admins, roleFilter, searchQuery]);

  // Group admins by role
  const adminsByRole = useMemo(() => {
    return filteredAdmins.reduce((acc, admin) => {
      const roleKey = admin.role || "unassigned";
      if (!acc[roleKey]) acc[roleKey] = [];
      acc[roleKey].push(admin);
      return acc;
    }, {} as Record<string, Admin[]>);
  }, [filteredAdmins]);

  // Calculate permission stats
  const permissionStats = useMemo(() => {
    const stats: Record<string, { count: number; percentage: number }> = {};
    const activeAdmins = admins.filter((a) => a.is_active);
    const totalActive = activeAdmins.length || 1;

    ADMIN_PERMISSIONS.forEach((perm) => {
      const count = activeAdmins.filter((admin) => admin.permissions.includes(perm.id)).length;
      stats[perm.id] = {
        count,
        percentage: Math.round((count / totalActive) * 100),
      };
    });

    return stats;
  }, [admins]);

  const handleTogglePermission = async (admin: Admin, permissionId: string) => {
    if (!canManageAdmins) return;
    if (admin.id === currentAdmin?.id) {
      toast({
        title: "Not allowed",
        description: "You cannot change your own permissions from this screen.",
        variant: "destructive",
      });
      return;
    }

    try {
      setUpdatingAdminId(admin.id);

      const hasPermission = admin.permissions.includes(permissionId);
      const updatedPermissions = hasPermission
        ? admin.permissions.filter((p) => p !== permissionId)
        : [...admin.permissions, permissionId];

      await adminManagementApi.update(admin.id, {
        permissions: updatedPermissions,
      });

      setAdmins((prev) =>
        prev.map((a) =>
          a.id === admin.id
            ? {
                ...a,
                permissions: updatedPermissions,
              }
            : a
        )
      );

      toast({
        title: "Updated",
        description: `${hasPermission ? "Removed" : "Granted"} ${ADMIN_PERMISSIONS.find((p) => p.id === permissionId)?.label} for ${admin.email}`,
      });
    } catch (error) {
      logger.error("Error updating admin permissions", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update permissions",
        variant: "destructive",
      });
    } finally {
      setUpdatingAdminId(null);
    }
  };

  const handleApplyRoleDefaults = async (admin: Admin) => {
    if (!canManageAdmins || admin.id === currentAdmin?.id) return;

    const role = admin.role as AdminRole;
    if (!role || !ADMIN_ROLES.find((r) => r.id === role)) {
      toast({
        title: "Error",
        description: "Admin must have a valid role to apply defaults",
        variant: "destructive",
      });
      return;
    }

    try {
      setUpdatingAdminId(admin.id);
      const defaultPermissions = ADMIN_PERMISSIONS.filter((p) =>
        p.defaultRoles.includes(role)
      ).map((p) => p.id);

      await adminManagementApi.update(admin.id, {
        permissions: defaultPermissions,
      });

      setAdmins((prev) =>
        prev.map((a) =>
          a.id === admin.id
            ? {
                ...a,
                permissions: defaultPermissions,
              }
            : a
        )
      );

      toast({
        title: "Applied defaults",
        description: `Applied default permissions for ${role} role to ${admin.email}`,
      });
    } catch (error) {
      logger.error("Error applying role defaults", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to apply defaults",
        variant: "destructive",
      });
    } finally {
      setUpdatingAdminId(null);
    }
  };

  const handleResetPermissions = async () => {
    if (!resetTargetAdmin) return;

    await handleApplyRoleDefaults(resetTargetAdmin);
    setShowResetDialog(false);
    setResetTargetAdmin(null);
  };

  const getRoleColor = (role: string | null) => {
    switch (role) {
      case "super_admin":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
      case "admin":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "moderator":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
    }
  };

  const hasCustomPermissions = (admin: Admin) => {
    const role = admin.role as AdminRole;
    if (!role) return true;
    const defaultPerms = ADMIN_PERMISSIONS.filter((p) => p.defaultRoles.includes(role)).map((p) => p.id);
    const currentPerms = admin.permissions || [];
    return (
      currentPerms.length !== defaultPerms.length ||
      !defaultPerms.every((p) => currentPerms.includes(p)) ||
      !currentPerms.every((p) => defaultPerms.includes(p))
    );
  };

  if (!canManageAdmins) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <Shield className="h-10 w-10 text-muted-foreground mx-auto" />
              <h2 className="text-lg font-semibold">Access restricted</h2>
              <p className="text-sm text-muted-foreground">
                You do not have permission to manage roles and permissions.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Roles & Permissions
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage what each admin can do on the platform. Fine-tune permissions for granular access control.
          </p>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search admins by email, name, or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {ADMIN_ROLES.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.label}
                </SelectItem>
              ))}
              <SelectItem value="unassigned">No Role</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchAdmins}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Admins</p>
                <p className="text-2xl font-bold">{admins.length}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {admins.filter((a) => a.is_active).length} active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Super Admins</p>
                <p className="text-2xl font-bold">
                  {admins.filter((a) => a.role === "super_admin").length}
                </p>
              </div>
              <Shield className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">With Custom Perms</p>
                <p className="text-2xl font-bold">
                  {admins.filter(hasCustomPermissions).length}
                </p>
              </div>
              <Settings2 className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Filtered Results</p>
                <p className="text-2xl font-bold">{filteredAdmins.length}</p>
              </div>
              <Filter className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role overview */}
      <div className="grid gap-4 md:grid-cols-3">
        {ADMIN_ROLES.map((role) => {
          const roleAdmins = admins.filter((a) => a.role === role.id);
          const defaultPerms = ADMIN_PERMISSIONS.filter((p) => p.defaultRoles.includes(role.id));
          return (
            <Card key={role.id} className="relative">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <Badge className={cn("px-2 py-0.5 text-xs", getRoleColor(role.id))}>
                    {role.label}
                  </Badge>
                  <span className="text-xs font-normal text-muted-foreground">
                    {roleAdmins.length} admin{roleAdmins.length !== 1 ? "s" : ""}
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">{role.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Default permissions</p>
                <div className="flex flex-wrap gap-1.5">
                  {defaultPerms.length > 0 ? (
                    defaultPerms.map((perm) => (
                      <Tooltip key={perm.id}>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="outline"
                            className="text-[11px] font-normal px-1.5 py-0.5 cursor-help"
                          >
                            {perm.label}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs max-w-xs">{perm.description}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">No defaults</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Permissions matrix */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Admin Permissions Matrix
              </CardTitle>
              <CardDescription className="mt-1">
                Toggle permissions per admin. Click permission headers for descriptions.
              </CardDescription>
            </div>
            {filteredAdmins.length !== admins.length && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setRoleFilter("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Loading admins...</p>
            </div>
          ) : filteredAdmins.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {searchQuery || roleFilter !== "all"
                    ? "No admins match your filters"
                    : "No admins found"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {searchQuery || roleFilter !== "all"
                    ? "Try adjusting your search or filter criteria"
                    : "Create an admin first from the Admins page"}
                </p>
              </div>
            </div>
          ) : (
            <div className="min-w-[800px] space-y-6">
                {Object.entries(adminsByRole).map(([roleKey, roleAdmins]) => (
                  <div key={roleKey} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={cn("px-2 py-0.5 text-xs", getRoleColor(roleKey))}>
                          {roleKey === "unassigned"
                            ? "No role"
                            : roleKey.replace("_", " ").toUpperCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {roleAdmins.length} admin{roleAdmins.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <div className="border border-border/70 rounded-lg overflow-hidden shadow-sm">
                      {/* Header row */}
                      <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm border-b border-border/60">
                        <div className="grid" style={{ gridTemplateColumns: `minmax(220px, 1fr) repeat(${ADMIN_PERMISSIONS.length}, minmax(140px, 1fr))` }}>
                          <div className="px-4 py-3 border-r border-border/60 flex items-center gap-2 bg-card/50">
                            <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="font-medium">Admin</span>
                          </div>
                          {ADMIN_PERMISSIONS.map((perm) => (
                            <Tooltip key={perm.id}>
                              <TooltipTrigger asChild>
                                <div className="px-2 py-3 border-r border-border/60 flex flex-col items-center justify-center gap-1 cursor-help hover:bg-muted/40 transition-colors group">
                                  <span className="text-xs font-medium text-center leading-tight px-1 break-words">{perm.label}</span>
                                  <HelpCircle className="h-3 w-3 text-muted-foreground opacity-40 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-xs">
                                <p className="font-medium mb-1">{perm.label}</p>
                                <p className="text-xs">{perm.description}</p>
                                <div className="mt-2 pt-2 border-t border-border/50">
                                  <p className="text-xs text-muted-foreground">
                                    {permissionStats[perm.id]?.count || 0} of {admins.filter((a) => a.is_active).length} active admins ({permissionStats[perm.id]?.percentage || 0}%)
                                  </p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                      {/* Admin rows */}
                      <div className="divide-y divide-border/60 bg-card">
                        {roleAdmins.map((admin) => {
                          const isUpdating = updatingAdminId === admin.id;
                          const isCurrentUser = admin.id === currentAdmin?.id;
                          const hasCustom = hasCustomPermissions(admin);
                          const disabled = isUpdating || isCurrentUser;

                          return (
                            <div
                              key={admin.id}
                              className={cn(
                                "grid text-xs transition-colors relative",
                                !admin.is_active && "opacity-50",
                                isUpdating && "opacity-70",
                                isCurrentUser && "bg-muted/20"
                              )}
                              style={{ gridTemplateColumns: `minmax(220px, 1fr) repeat(${ADMIN_PERMISSIONS.length}, minmax(140px, 1fr))` }}
                            >
                              {isCurrentUser && (
                                <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-primary/20 rounded" />
                              )}
                              <div className={cn(
                                "px-4 py-3 border-r border-border/60 flex flex-col gap-1.5 bg-card/30",
                                isCurrentUser && "bg-primary/5"
                              )}>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium truncate">
                                    {admin.full_name || admin.username || admin.email}
                                  </span>
                                  {isCurrentUser && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] px-1.5 py-0 border-primary/30 bg-primary/10 text-primary cursor-help"
                                        >
                                          You
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs">You cannot edit your own permissions here to prevent accidental lockout. Use the Account Settings page to manage your account.</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  {hasCustom && !isCurrentUser && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Sparkles className="h-3 w-3 text-blue-600" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs">Custom permissions (differs from role defaults)</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  {isUpdating && (
                                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                  )}
                                </div>
                                <span className="text-[11px] text-muted-foreground truncate">
                                  {admin.email}
                                </span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {admin.is_active ? (
                                    <>
                                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                                      <span className="text-[10px] text-green-600">Active</span>
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="h-3 w-3 text-red-600" />
                                      <span className="text-[10px] text-red-600">Inactive</span>
                                    </>
                                  )}
                                  {hasCustom && !isCurrentUser && admin.role && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-5 px-2 text-[10px] ml-auto"
                                      onClick={() => handleApplyRoleDefaults(admin)}
                                      disabled={isUpdating}
                                      title="Apply role defaults"
                                    >
                                      <RefreshCw className="h-3 w-3 mr-1" />
                                      Reset
                                    </Button>
                                  )}
                                  {isCurrentUser && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Info className="h-3 w-3 text-muted-foreground ml-auto" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs">View-only: Edit your permissions from Account Settings</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </div>
                              {ADMIN_PERMISSIONS.map((perm) => {
                                const checked = admin.permissions.includes(perm.id);
                                return (
                                  <Tooltip key={perm.id}>
                                    <TooltipTrigger asChild>
                                      <div
                                        onClick={() => !disabled && handleTogglePermission(admin, perm.id)}
                                        className={cn(
                                          "px-3 py-3 border-r border-border/60 flex items-center justify-center relative group",
                                          !disabled && "hover:bg-muted/60 transition-colors cursor-pointer",
                                          disabled && "cursor-not-allowed",
                                          checked && !disabled && "bg-primary/5",
                                          checked && disabled && "bg-primary/5",
                                          isCurrentUser && "bg-muted/10"
                                        )}
                                      >
                                        <Checkbox
                                          checked={checked}
                                          onCheckedChange={() => !disabled && handleTogglePermission(admin, perm.id)}
                                          disabled={disabled}
                                        />
                                        {isCurrentUser && (
                                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <Lock className="h-3 w-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                                          </div>
                                        )}
                                      </div>
                                    </TooltipTrigger>
                                    {isCurrentUser && (
                                      <TooltipContent>
                                        <p className="text-xs">View-only: Cannot edit your own permissions here to prevent lockout</p>
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        title="Reset Permissions"
        description={
          resetTargetAdmin
            ? `Reset ${resetTargetAdmin.email}'s permissions to the default permissions for their role (${resetTargetAdmin.role})?`
            : ""
        }
        confirmText="Reset"
        cancelText="Cancel"
        variant="default"
        onConfirm={handleResetPermissions}
      />
    </div>
  );
}

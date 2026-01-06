"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Shield, Users, CheckCircle2, XCircle, Info, Lock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAdmin } from "@/contexts/admin-context";
import { adminManagementApi } from "@/lib/api-client";
import { ADMIN_ROLES, ADMIN_PERMISSIONS, type AdminPermissionDefinition } from "@/lib/admin-permissions";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

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

  const handleTogglePermission = async (admin: Admin, permissionId: string) => {
    if (!canManageAdmins) return;
    // Prevent editing your own permissions from this screen to avoid lockout
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
        description: `Permissions updated for ${admin.email}`,
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

  const adminsByRole: Record<string, Admin[]> = admins.reduce((acc, admin) => {
    const roleKey = admin.role || "unassigned";
    if (!acc[roleKey]) acc[roleKey] = [];
    acc[roleKey].push(admin);
    return acc;
  }, {} as Record<string, Admin[]>);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Roles & Permissions
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage what each admin can do on the platform.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
          <Info className="h-4 w-4" />
          <span>Use this page to fine-tune permissions across all admin accounts.</span>
        </div>
      </div>

      {/* Role overview */}
      <div className="grid gap-4 md:grid-cols-3">
        {ADMIN_ROLES.map((role) => (
          <Card key={role.id}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Badge className={cn("px-2 py-0.5 text-xs", getRoleColor(role.id))}>
                  {role.label}
                </Badge>
              </CardTitle>
              <CardDescription>{role.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Default permissions</p>
              <div className="flex flex-wrap gap-1.5">
                {ADMIN_PERMISSIONS.filter((p) => p.defaultRoles.includes(role.id)).map(
                  (perm) => (
                    <Badge
                      key={perm.id}
                      variant="outline"
                      className="text-[11px] font-normal px-1.5 py-0.5"
                    >
                      {perm.label}
                    </Badge>
                  )
                )}
                {ADMIN_PERMISSIONS.filter((p) => p.defaultRoles.includes(role.id)).length ===
                  0 && (
                  <span className="text-xs text-muted-foreground">No defaults</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Actual permissions are set per admin below.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Permissions matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Admin Permissions Matrix
          </CardTitle>
          <CardDescription>
            Toggle permissions per admin. Super admins can change other admins but not themselves
            here.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading admins...
            </div>
          ) : admins.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No admins found. Create an admin first from the Admins page.
            </div>
          ) : (
            <div className="min-w-[720px] space-y-4">
              {Object.entries(adminsByRole).map(([roleKey, roleAdmins]) => (
                <div key={roleKey} className="space-y-2">
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
                  <div className="border border-border/70 rounded-lg overflow-hidden">
                    <div className="grid grid-cols-[minmax(160px,0.2fr),repeat(auto-fit,minmax(140px,0.2fr))] bg-muted/60 text-xs font-medium">
                      <div className="px-3 py-2 border-r border-border/60 flex items-center gap-1">
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Admin</span>
                      </div>
                      {ADMIN_PERMISSIONS.map((perm) => (
                        <div
                          key={perm.id}
                          className="px-3 py-2 border-r border-border/60 flex items-center gap-1"
                        >
                          <span className="truncate">{perm.label}</span>
                        </div>
                      ))}
                    </div>
                    <div className="divide-y divide-border/60">
                      {roleAdmins.map((admin) => (
                        <div
                          key={admin.id}
                          className={cn(
                            "grid grid-cols-[minmax(160px,0.2fr),repeat(auto-fit,minmax(140px,0.2fr))] text-xs",
                            !admin.is_active && "opacity-60"
                          )}
                        >
                          <div className="px-3 py-2 border-r border-border/60 flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium truncate">
                                {admin.full_name || admin.username || admin.email}
                              </span>
                              {admin.id === currentAdmin?.id && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1 py-0 border-dashed"
                                >
                                  You
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground truncate">
                              {admin.email}
                            </span>
                            <div className="flex items-center gap-1 mt-0.5">
                              {admin.is_active ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-600" />
                              )}
                              <span className="text-[10px] text-muted-foreground">
                                {admin.is_active ? "Active" : "Inactive"}
                              </span>
                            </div>
                          </div>
                          {ADMIN_PERMISSIONS.map((perm) => {
                            const checked = admin.permissions.includes(perm.id);
                            const disabled =
                              updatingAdminId === admin.id || admin.id === currentAdmin?.id;
                            return (
                              <div
                                key={perm.id}
                                onClick={() => !disabled && handleTogglePermission(admin, perm.id)}
                                className={cn(
                                  "px-3 py-2 border-r border-border/60 flex items-center justify-center",
                                  !disabled && "hover:bg-muted/60 transition-colors cursor-pointer",
                                  disabled && "cursor-not-allowed opacity-60"
                                )}
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => !disabled && handleTogglePermission(admin, perm.id)}
                                  disabled={disabled}
                                />
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}



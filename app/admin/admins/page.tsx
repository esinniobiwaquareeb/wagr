"use client";

import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { 
  Shield, 
  Plus, 
  Edit, 
  Trash2, 
  CheckCircle, 
  XCircle,
  ShieldCheck,
  User,
  Mail,
  Calendar,
  Key,
  Eye,
  EyeOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/data-table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useAdmin } from "@/contexts/admin-context";
import { adminManagementApi } from "@/lib/api-client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

import { ADMIN_PERMISSIONS } from "@/lib/admin-permissions";

interface Admin {
  id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  role: string | null;
  is_active: boolean;
  permissions: string[];
  two_factor_enabled?: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

const PERMISSIONS = ADMIN_PERMISSIONS.map((p) => ({ id: p.id, label: p.label }));

export default function AdminAdminsPage() {
  const { toast } = useToast();
  const { admin: currentAdmin } = useAdmin();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    full_name: "",
    password: "",
    role: "admin",
    permissions: [] as string[],
    is_active: true,
  });

  const canManageAdmins = currentAdmin?.permissions?.includes('manage_admins') || currentAdmin?.role === 'super_admin';

  const fetchAdmins = useCallback(async () => {
    if (!canManageAdmins) return;

    try {
      setLoading(true);
      const data = await adminManagementApi.getAll();
      setAdmins(data.admins || []);
    } catch (error) {
      logger.error("Error fetching admins", error);
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

  const handleCreate = async () => {
    if (!formData.email || !formData.password) {
      toast({
        title: "Error",
        description: "Email and password are required",
        variant: "destructive",
      });
      return;
    }

    if (formData.password.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }

    try {
      await adminManagementApi.create(formData);
      toast({
        title: "Success",
        description: "Admin created successfully",
      });
      setShowCreateDialog(false);
      resetForm();
      fetchAdmins();
    } catch (error) {
      logger.error("Error creating admin", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create admin",
        variant: "destructive",
      });
    }
  };

  const handleUpdate = async () => {
    if (!selectedAdmin) return;

    if (!formData.email) {
      toast({
        title: "Error",
        description: "Email is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const updateData: any = { ...formData };
      if (!updateData.password) {
        delete updateData.password;
      } else if (updateData.password.length < 8) {
        toast({
          title: "Error",
          description: "Password must be at least 8 characters long",
          variant: "destructive",
        });
        return;
      }

      await adminManagementApi.update(selectedAdmin.id, updateData);
      toast({
        title: "Success",
        description: "Admin updated successfully",
      });
      setShowEditDialog(false);
      resetForm();
      fetchAdmins();
    } catch (error) {
      logger.error("Error updating admin", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update admin",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedAdmin) return;

    try {
      await adminManagementApi.delete(selectedAdmin.id);
      toast({
        title: "Success",
        description: "Admin deactivated successfully",
      });
      setShowDeleteDialog(false);
      setSelectedAdmin(null);
      fetchAdmins();
    } catch (error) {
      logger.error("Error deleting admin", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to deactivate admin",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      email: "",
      username: "",
      full_name: "",
      password: "",
      role: "admin",
      permissions: [],
      is_active: true,
    });
    setSelectedAdmin(null);
  };

  const openEditDialog = (admin: Admin) => {
    setSelectedAdmin(admin);
    setFormData({
      email: admin.email,
      username: admin.username || "",
      full_name: admin.full_name || "",
      password: "",
      role: admin.role || "admin",
      permissions: admin.permissions || [],
      is_active: admin.is_active,
    });
    setShowEditDialog(true);
  };

  const togglePermission = (permissionId: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter((p) => p !== permissionId)
        : [...prev.permissions, permissionId],
    }));
  };

  const getRoleBadgeColor = (role?: string | null) => {
    switch (role) {
      case 'super_admin':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'admin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'moderator':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  const columns: Column<Admin>[] = [
    {
      id: "email",
      header: "Email",
      accessorKey: "email",
      cell: (row: Admin) => (
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.email}</span>
        </div>
      ),
    },
    {
      id: "name",
      header: "Name",
      accessorKey: "full_name",
      cell: (row: Admin) => (
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span>{row.full_name || row.username || "N/A"}</span>
        </div>
      ),
    },
    {
      id: "role",
      header: "Role",
      accessorKey: "role",
      cell: (row: Admin) => (
        <Badge className={cn(getRoleBadgeColor(row.role))}>
          {row.role || "N/A"}
        </Badge>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorKey: "is_active",
      cell: (row: Admin) => (
        <div className="flex items-center gap-2">
          {row.is_active ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-green-600">Active</span>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-red-600">Inactive</span>
            </>
          )}
        </div>
      ),
    },
    {
      id: "2fa",
      header: "2FA",
      accessorKey: "two_factor_enabled",
      cell: (row: Admin) => (
        row.two_factor_enabled ? (
          <Badge variant="outline" className="text-green-600 border-green-600">
            <ShieldCheck className="h-3 w-3 mr-1" />
            Enabled
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            Disabled
          </Badge>
        )
      ),
    },
    {
      id: "permissions",
      header: "Permissions",
      accessorKey: "permissions",
      cell: (row: Admin) => (
        <span className="text-sm text-muted-foreground">
          {row.permissions?.length || 0} permission(s)
        </span>
      ),
    },
    {
      id: "last_login",
      header: "Last Login",
      accessorKey: "last_login_at",
      cell: (row: Admin) => (
        row.last_login_at ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {format(new Date(row.last_login_at), "MMM d, yyyy")}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">Never</span>
        )
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row: Admin) => {
        const admin = row;
        const isCurrentAdmin = admin.id === currentAdmin?.id;
        
        return (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openEditDialog(admin)}
              disabled={isCurrentAdmin}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedAdmin(admin);
                setShowDeleteDialog(true);
              }}
              disabled={isCurrentAdmin}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        );
      },
    },
  ];

  if (!canManageAdmins) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-muted-foreground">
                You don't have permission to manage admins.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Admin Management
          </h1>
          <p className="text-muted-foreground mt-1">Manage admin accounts and permissions</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Admin
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Admins</CardTitle>
          <CardDescription>List of all admin accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            data={admins}
            columns={columns}
            searchable
            searchPlaceholder="Search by email, name..."
          />
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Admin</DialogTitle>
            <DialogDescription>Create a new admin account</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="admin@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="admin_user"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Admin User"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Minimum 8 characters"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                type="text"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                placeholder="admin, super_admin, moderator"
              />
            </div>

            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
                {PERMISSIONS.map((permission) => (
                  <div key={permission.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={permission.id}
                      checked={formData.permissions.includes(permission.id)}
                      onCheckedChange={() => togglePermission(permission.id)}
                    />
                    <Label
                      htmlFor={permission.id}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {permission.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked as boolean })
                }
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Active
              </Label>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => {
                setShowCreateDialog(false);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>
                Create Admin
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Admin</DialogTitle>
            <DialogDescription>Update admin account details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-full_name">Full Name</Label>
              <Input
                id="edit-full_name"
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-password">New Password (leave blank to keep current)</Label>
              <div className="relative">
                <Input
                  id="edit-password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Leave blank to keep current password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Input
                id="edit-role"
                type="text"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
                {PERMISSIONS.map((permission) => (
                  <div key={permission.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`edit-${permission.id}`}
                      checked={formData.permissions.includes(permission.id)}
                      onCheckedChange={() => togglePermission(permission.id)}
                    />
                    <Label
                      htmlFor={`edit-${permission.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {permission.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked as boolean })
                }
              />
              <Label htmlFor="edit-is_active" className="cursor-pointer">
                Active
              </Label>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => {
                setShowEditDialog(false);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button onClick={handleUpdate}>
                Update Admin
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Deactivate Admin"
        description={`Are you sure you want to deactivate ${selectedAdmin?.email}? This will prevent them from logging in.`}
        confirmText="Deactivate"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}


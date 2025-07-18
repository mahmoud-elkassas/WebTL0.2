"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/ui/user-avatar";
import { toast } from "sonner";
import { Profile, UserRole } from "@/types";
import supabase from "@/lib/supabase";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

interface UserCardProps {
  user: Profile;
  currentUser: Profile;
  onUpdate: () => void;
}

export function UserCard({ user, currentUser, onUpdate }: UserCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [role, setRole] = useState<UserRole>(user.role);

  const isCurrentUser = currentUser.id === user.id;

  async function updateUserRole() {
    if (isCurrentUser && role !== "admin") {
      toast.error("You cannot demote yourself from admin");
      setRole("admin");
      return;
    }

    setIsLoading(true);

    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          role,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      toast.success("User role updated successfully");
      onUpdate();
    } catch (error) {
      console.error("Error updating user role:", error);
      toast.error(
        "Failed to update user role. Make sure you have admin privileges."
      );
      setRole(user.role);
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteUser() {
    if (isCurrentUser) {
      toast.error("You cannot delete your own account");
      return;
    }

    setIsDeleting(true);

    try {
      // Get the current session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No active session");
      }

      console.log(`Starting deletion process for user: ${user.id}`);

      // Step 1: Delete all related data to avoid foreign key constraints
      // Note: access_requests has ON DELETE CASCADE, so it will be auto-deleted

      // Update api_keys updated_by to null (has ON DELETE SET NULL)
      const { error: apiKeysError } = await supabase
        .from("api_keys")
        .update({ updated_by: null })
        .eq("updated_by", user.id);

      if (apiKeysError) {
        console.warn("Error updating api_keys updated_by:", apiKeysError);
      }

      // Delete any translations created by the user
      const { error: translationsError } = await supabase
        .from("translations")
        .delete()
        .eq("created_by", user.id);

      if (translationsError) {
        console.warn("Error deleting translations:", translationsError);
      }

      // Delete any glossary terms created by the user
      const { error: glossaryError } = await supabase
        .from("glossaries")
        .delete()
        .eq("created_by", user.id);

      if (glossaryError) {
        console.warn("Error deleting glossary terms:", glossaryError);
      }

      // Delete any chapters created by the user
      const { error: chaptersError } = await supabase
        .from("chapters")
        .delete()
        .eq("created_by", user.id);

      if (chaptersError) {
        console.warn("Error deleting chapters:", chaptersError);
      }

      // Delete any series created by the user
      const { error: seriesError } = await supabase
        .from("series")
        .delete()
        .eq("created_by", user.id);

      if (seriesError) {
        console.warn("Error deleting series:", seriesError);
      }

      // Step 2: Delete the user profile
      // The database trigger should handle deleting from auth.users
      // access_requests will be auto-deleted due to ON DELETE CASCADE
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", user.id);

      if (profileError) {
        throw new Error(
          `Failed to delete user profile: ${profileError.message}`
        );
      }

      console.log(`Successfully deleted user: ${user.id}`);
      toast.success("User deleted successfully");
      onUpdate();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete user. Please try again."
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between w-full space-x-4">
          <div className="flex items-center space-x-3">
            <UserAvatar user={user} />
            <div>
              <p className="text-sm font-medium">
                {user.full_name || user.email}
                {isCurrentUser && <Badge className="ml-2">You</Badge>}
              </p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium">Role:</p>
              <Select
                disabled={isLoading}
                value={role}
                onValueChange={(value: UserRole) => setRole(value)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="translator">Translator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              size="sm"
              onClick={updateUserRole}
              disabled={isLoading || role === user.role}
            >
              {isLoading ? "Updating..." : "Update Role"}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isDeleting || isCurrentUser}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete User</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this user? This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={deleteUser}
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

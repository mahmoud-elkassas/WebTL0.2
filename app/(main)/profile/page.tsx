"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { getUserProfile, signOut, checkAccessRequest } from "@/lib/auth";
import { AccessRequestForm } from "@/components/auth/access-request-form";
import { Profile } from "@/types";
import { Loader, LogOut } from "lucide-react";

export default function ProfilePage() {
  const [user, setUser] = useState<Profile | null>(null);
  const [accessStatus, setAccessStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadUserData = async () => {
      const profile = await getUserProfile();
      setUser(profile);

      if (profile) {
        const status = await checkAccessRequest();
        setAccessStatus(status);
      }

      setIsLoading(false);
    };

    loadUserData();
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center py-24">
        <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Profile</h1>
          <p className="text-muted-foreground mt-2">
            Manage your account and access
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-muted-foreground">{user.email}</p>
              </div>

              <div>
                <p className="text-sm font-medium">Name</p>
                <p className="text-muted-foreground">
                  {user.full_name || "Not set"}
                </p>
              </div>

              <div>
                <p className="text-sm font-medium mb-2 fle">Role</p>
                <div className="flex items-center gap-2 ">
                  <Badge
                    variant={user.role === "admin" ? "default" : "outline"}
                  >
                    {user.role === "admin"
                      ? "Admin"
                      : user.role === "translator"
                      ? "Translator"
                      : "User"}
                  </Badge>
                  {user.role === "user" && (
                    <p className="text-xs text-muted-foreground">
                      (Limited access)
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </Button>
            </CardFooter>
          </Card>

          {user.role === "user" && (
            <Card>
              <CardHeader>
                <CardTitle>Access Request</CardTitle>
                <CardDescription>
                  {accessStatus === "pending"
                    ? "Your access request is currently pending approval"
                    : accessStatus === "approved"
                    ? "Your access request has been approved"
                    : accessStatus === "rejected"
                    ? "Your access request was rejected"
                    : "Request translator access to use the translation tool"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {accessStatus === "pending" ? (
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm">
                      Your request is being reviewed by an administrator. You'll
                      be notified when it's approved.
                    </p>
                  </div>
                ) : accessStatus === "approved" ? (
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm">
                      Your request has been approved, but your role might need
                      to be updated. Please contact an administrator if you
                      still can't access the tool.
                    </p>
                  </div>
                ) : (
                  <AccessRequestForm />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

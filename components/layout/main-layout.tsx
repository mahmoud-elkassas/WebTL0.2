"use client";

import { useState, useEffect } from "react";
import { MainNav } from "@/components/layout/main-nav";
import { Profile } from "@/types";
import { getUserProfile, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Toaster } from "sonner";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadUser = async () => {
      const profile = await getUserProfile();
      setUser(profile);
      setIsLoading(false);
    };

    loadUser();
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
    router.push("/login");
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header>
        <MainNav user={user} />
      </header>
      <main className="flex-1 container mx-auto py-6 px-4">{children}</main>
      <footer className="border-t py-6 bg-muted/40">
        <div className="container mx-auto px-4 flex flex-col-reverse md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground text-center md:text-left">
            © {new Date().getFullYear()} WebTL. All rights reserved.
          </div>
          {user && (
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              Log out
            </Button>
          )}
        </div>
      </footer>
      <Toaster position="top-right" />
    </div>
  );
}

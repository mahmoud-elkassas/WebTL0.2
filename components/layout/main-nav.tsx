"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { Profile } from "@/types";
import { Moon, Sun, Menu, X, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { signOut } from "@/lib/auth";

interface MainNavProps {
  user: Profile | null;
}

export function MainNav({ user }: MainNavProps) {
  const pathname = usePathname();
  const { setTheme, theme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };
  const isAdmin = user?.role === "admin";
  const isTranslator = user?.role === "translator" || isAdmin;

  const routes = [
    { href: "/", label: "Home", active: pathname === "/", visible: true },
    {
      href: "/translate",
      label: "Translate",
      active: pathname === "/translate",
      visible: isTranslator,
    },
    {
      href: "/series",
      label: "Series",
      active: pathname === "/series",
      visible: isTranslator,
    },
    {
      href: "/admin",
      label: "Admin",
      active: pathname?.startsWith("/admin") || false,
      visible: isAdmin,
    },
  ];

  return (
    <div className="flex items-center justify-between h-16 px-4 border-b max-w-[1320px] mx-auto relative">
      {/* Logo + Desktop Nav */}
      <div className="flex items-center space-x-4">
        <Link href="/">
          <Logo />
        </Link>
        <nav className="hidden md:flex items-center space-x-4 lg:space-x-6">
          {routes
            .filter((route) => route.visible)
            .map((route) => (
              <Link
                key={route.href}
                href={route.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  route.active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {route.label}
              </Link>
            ))}
        </nav>
      </div>

      {/* Theme toggle + user + mobile menu toggle */}
      <div className="flex items-center gap-2 md:gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          aria-label="Toggle theme"
        >
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        {!user ? (
          <div className="hidden md:flex gap-2">
            <Button asChild variant="ghost">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Sign up</Link>
            </Button>
          </div>
        ) : (
          <Button asChild variant="ghost" className="hidden md:inline-flex">
            <Link href="/profile">Profile</Link>
          </Button>
        )}

        {/* Hamburger menu toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile Dropdown Menu */}
      {menuOpen && (
        <div className="absolute top-16 left-0 w-full bg-white dark:bg-background border-t shadow-md px-4 py-4 flex flex-col gap-4 md:hidden z-50">
          {routes
            .filter((route) => route.visible)
            .map((route) => (
              <Link
                key={route.href}
                href={route.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-primary",
                  route.active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {route.label}
              </Link>
            ))}

          {!user ? (
            <>
              <Button
                asChild
                variant="ghost"
                onClick={() => setMenuOpen(false)}
              >
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild onClick={() => setMenuOpen(false)}>
                <Link href="/register">Sign up</Link>
              </Button>
            </>
          ) : (
            <div className="flex flex-col gap-2 items-start pb-4">
              <Link
                href="/profile"
                className="text-sm font-medium text-muted-foreground my-2"
              >
                Profile
              </Link>

              <Button
                variant="outline"
                onClick={handleSignOut}
                className="text-sm font-medium"
              >
                <LogOut className="h-4 w-4 mr-2 text-red-500" />
                Sign out
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

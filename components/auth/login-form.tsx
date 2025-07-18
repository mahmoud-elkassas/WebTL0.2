"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { signIn, resetPassword } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters." }),
});

const resetPasswordSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
});

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const resetForm = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);

    try {
      const { data, error } = await signIn(values.email, values.password);

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data.user) {
        toast.success("Successfully logged in");
        router.push("/");
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to log in");
    } finally {
      setIsLoading(false);
    }
  }

  async function onResetPassword(values: z.infer<typeof resetPasswordSchema>) {
    setIsResetLoading(true);

    try {
      const { error } = await resetPassword(values.email);

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Password reset email sent! Check your inbox.");
      setIsForgotPasswordOpen(false);
      resetForm.reset();
    } catch (error) {
      toast.error("Failed to send reset email");
    } finally {
      setIsResetLoading(false);
    }
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="you@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Logging in..." : "Log in"}
          </Button>

          <div className="text-center space-y-2">
            <button
              type="button"
              onClick={() => setIsForgotPasswordOpen(true)}
              className="text-sm text-primary hover:underline"
            >
              Forgot your password?
            </button>
            <div className="text-sm">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-primary hover:underline">
                Sign up
              </Link>
            </div>
          </div>
        </form>
      </Form>

      {/* Forgot Password Dialog */}
      <Dialog
        open={isForgotPasswordOpen}
        onOpenChange={setIsForgotPasswordOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>
              Enter your email address and we'll send you a link to reset your
              password.
            </DialogDescription>
          </DialogHeader>

          <Form {...resetForm}>
            <form
              onSubmit={resetForm.handleSubmit(onResetPassword)}
              className="space-y-4"
            >
              <FormField
                control={resetForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsForgotPasswordOpen(false)}
                  disabled={isResetLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isResetLoading}>
                  {isResetLoading ? "Sending..." : "Send reset email"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

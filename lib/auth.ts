import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";
import { Profile, UserRole } from "@/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

export async function signUp(
  email: string,
  password: string,
  full_name?: string
) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        full_name: full_name ? full_name.trim() : null,
      },
    },
  });

  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function resetPassword(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `https://toontl.net/reset-password`,
  });

  return { data, error };
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  return { session: data.session, error };
}

export async function getUserProfile(): Promise<Profile | null> {
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session?.user) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", sessionData.session.user.id)
    .single();

  if (error || !data) {
    console.error("Error fetching user profile:", error);
    return null;
  }

  return data as Profile;
}

export async function hasAccess(
  requiredRole: UserRole = "translator"
): Promise<boolean> {
  const profile = await getUserProfile();

  if (!profile) {
    return false;
  }

  if (profile.role === "admin") {
    return true;
  }

  if (requiredRole === "translator" && profile.role === "translator") {
    return true;
  }

  if (requiredRole === "user") {
    return true;
  }

  return false;
}

// New admin-specific functions
export async function isAdmin(): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session?.user) {
    return false;
  }

  // Try new user_roles table first
  try {
    const { data, error } = await supabase
      .from("user_roles" as any)
      .select("role")
      .eq("user_id", sessionData.session.user.id)
      .single();

    if (!error && data) {
      return (data as any).role === "admin";
    }
  } catch (error) {
    console.log("user_roles table not found, falling back to profiles");
  }

  // Fallback to profiles table
  const profile = await getUserProfile();
  return profile?.role === "admin";
}

export async function canAccessSeries(seriesId: string): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session?.user) {
    return false;
  }

  // Check if user is admin first
  const adminStatus = await isAdmin();
  if (adminStatus) {
    return true;
  }

  try {
    // Use the RPC function
    const { data, error } = await supabase.rpc("can_access_series" as any, {
      user_id: sessionData.session.user.id,
      series_id: seriesId,
    });

    if (!error) {
      return data === true;
    }
  } catch (error) {
    console.log("RPC function not available, checking permissions manually");
  }

  try {
    // Manual check - STRICT: User must have explicit permission (no open access)
    const { data: permissions } = await supabase
      .from("series_permissions" as any)
      .select("user_id")
      .eq("series_id", seriesId);

    // Check if user has explicit permission
    if (permissions && permissions.length > 0) {
      const userPermission = permissions.find(
        (p: any) => p.user_id === sessionData.session.user.id
      );
      return !!userPermission;
    }

    // If no permissions are set for this series, only admin can access
    // This implements the strict requirement: by default no access unless admin
    return false;
  } catch (error) {
    console.error("Error checking series access:", error);
    return false;
  }
}

export async function getAllUsers() {
  try {
    // Try the view first
    const { data, error } = await supabase
      .from("user_profiles_with_roles" as any)
      .select("*")
      .order("email");

    if (!error && data) {
      return data;
    }
  } catch (error) {
    console.log("View not available, using profiles table");
  }

  // Fallback to profiles table
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("email");

  if (error) {
    console.error("Error fetching users:", error);
    return [];
  }

  return data || [];
}

export async function getSeriesPermissions(seriesId: string) {
  try {
    const { data, error } = await supabase
      .from("series_permissions" as any)
      .select("*")
      .eq("series_id", seriesId);

    if (error) {
      console.error("Error fetching series permissions:", error);
      return [];
    }

    // Get user emails separately
    if (data && data.length > 0) {
      const userIds = data.map((p: any) => p.user_id);

      // Try to get user emails from profiles
      const { data: users } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds);

      // Combine permissions with user data
      return data.map((permission: any) => ({
        ...permission,
        user: users?.find((u: any) => u.id === permission.user_id) || null,
      }));
    }

    return data || [];
  } catch (error) {
    console.error("Error fetching series permissions:", error);
    return [];
  }
}

export async function grantSeriesAccess(
  seriesId: string,
  userId: string,
  permissionType: "read" | "write" | "admin" = "read"
) {
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session?.user) {
    throw new Error("Not authenticated");
  }

  try {
    const { data, error } = await supabase
      .from("series_permissions" as any)
      .upsert(
        {
          series_id: seriesId,
          user_id: userId,
          permission_type: permissionType,
          granted_by: sessionData.session.user.id,
        },
        {
          onConflict: "series_id,user_id",
        }
      );

    if (error) {
      throw new Error(`Failed to grant access: ${error.message}`);
    }

    return data;
  } catch (error) {
    throw new Error(
      `Failed to grant access: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function revokeSeriesAccess(seriesId: string, userId: string) {
  try {
    const { error } = await supabase
      .from("series_permissions" as any)
      .delete()
      .eq("series_id", seriesId)
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to revoke access: ${error.message}`);
    }
  } catch (error) {
    throw new Error(
      `Failed to revoke access: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function makeUserAdmin(userId: string) {
  try {
    const { data, error } = await supabase.from("user_roles" as any).upsert(
      {
        user_id: userId,
        role: "admin",
      },
      {
        onConflict: "user_id",
      }
    );

    if (error) {
      throw new Error(`Failed to make user admin: ${error.message}`);
    }

    return data;
  } catch (error) {
    throw new Error(
      `Failed to make user admin: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function removeAdminRole(userId: string) {
  try {
    const { error } = await supabase
      .from("user_roles" as any)
      .delete()
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to remove admin role: ${error.message}`);
    }
  } catch (error) {
    throw new Error(
      `Failed to remove admin role: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function checkAccessRequest(): Promise<string | null> {
  const profile = await getUserProfile();

  if (!profile) {
    return null;
  }

  const { data, error } = await supabase
    .from("access_requests")
    .select("status")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error checking access request:", error);
    return null;
  }

  return data?.status || null;
}

export async function createAccessRequest(reason: string) {
  const profile = await getUserProfile();

  if (!profile) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase.from("access_requests").insert({
    user_id: profile.id,
    status: "pending",
    reason,
  });

  if (error) {
    throw new Error("Failed to create access request");
  }

  return data;
}

// New function to get only accessible series for the current user
export async function getAccessibleSeries() {
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session?.user) {
    return [];
  }

  try {
    // Use the RPC function to get accessible series
    const { data, error } = await supabase.rpc("get_accessible_series" as any, {
      user_id: sessionData.session.user.id,
    });

    if (error) {
      console.error("Error fetching accessible series:", error);
      // If RPC fails, fall back to manual check
      return await getFallbackAccessibleSeries();
    }

    return data || [];
  } catch (error) {
    console.error("RPC function not available, using fallback:", error);
    return await getFallbackAccessibleSeries();
  }
}

// Fallback function for when RPC is not available
async function getFallbackAccessibleSeries() {
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session?.user) {
    return [];
  }

  const adminStatus = await isAdmin();

  if (adminStatus) {
    // Admin can see all series
    const { data } = await supabase.from("series").select("*").order("name");
    return data || [];
  }

  try {
    // Get all series
    const { data: allSeries } = await supabase
      .from("series")
      .select("*")
      .order("name");
    if (!allSeries) return [];

    // Get all series permissions
    const { data: permissions } = await supabase
      .from("series_permissions" as any)
      .select("series_id, user_id");

    if (!permissions) {
      // If no permissions table exists, no series are accessible to non-admins
      return [];
    }

    const userPermissions = permissions.filter(
      (p: any) => p.user_id === sessionData.session.user.id
    );
    const userAccessibleSeriesIds = new Set(
      userPermissions.map((p: any) => p.series_id)
    );

    // STRICT: Only show series where user has explicit permission
    const accessibleSeries = allSeries.filter((series) => {
      return userAccessibleSeriesIds.has(series.id);
    });

    return accessibleSeries;
  } catch (error) {
    console.error("Error in fallback accessible series:", error);
    return [];
  }
}

// Check if user can delete a series
export async function canDeleteSeries(seriesId: string): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session?.user) {
    return false;
  }

  const adminStatus = await isAdmin();
  if (adminStatus) {
    return true;
  }

  // Check if user is the creator of the series
  const { data: series } = await supabase
    .from("series")
    .select("created_by")
    .eq("id", seriesId)
    .single();

  return series?.created_by === sessionData.session.user.id;
}

// Check if user can edit a series
export async function canEditSeries(seriesId: string): Promise<boolean> {
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session?.user) {
    return false;
  }

  const adminStatus = await isAdmin();
  if (adminStatus) {
    return true;
  }

  // Check if user is the creator of the series
  const { data: series } = await supabase
    .from("series")
    .select("created_by")
    .eq("id", seriesId)
    .single();

  if (series?.created_by === sessionData.session.user.id) {
    return true;
  }

  // Check if user has admin permission for this series
  try {
    const { data: permission, error } = await supabase
      .from("series_permissions" as any)
      .select("permission_type")
      .eq("series_id", seriesId)
      .eq("user_id", sessionData.session.user.id)
      .single();

    if (error || !permission) {
      return false;
    }

    return (permission as any).permission_type === "admin";
  } catch (error) {
    return false;
  }
}

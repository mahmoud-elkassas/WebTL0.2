"use client";

import { useEffect, useState } from "react";
import { getUserProfile, hasAccess } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCard } from "@/components/admin/user-card";
import { AccessRequestCard } from "@/components/admin/access-request-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Profile, AccessRequest, ApiKeysConfig } from "@/types";
import {
  Loader,
  Search,
  RefreshCw,
  Save,
  Plus,
  Trash2,
  Key,
} from "lucide-react";
import supabase from "@/lib/supabase";

export default function AdminPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [requestSearchQuery, setRequestSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // API Keys state
  const [apiKeysConfig, setApiKeysConfig] = useState<ApiKeysConfig>({
    gemini_keys: [],
    google_keys: [],
  });
  const [isLoadingApiKeys, setIsLoadingApiKeys] = useState(true);
  const [isSavingApiKeys, setIsSavingApiKeys] = useState(false);
  const [newGeminiKey, setNewGeminiKey] = useState("");
  const [newGoogleKey, setNewGoogleKey] = useState("");
  const [apiKeysRecordId, setApiKeysRecordId] = useState<string | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    const checkAccess = async () => {
      const access = await hasAccess("admin");
      setHasPermission(access);

      if (access) {
        const profile = await getUserProfile();
        setCurrentUser(profile);

        await fetchData();
        await fetchApiKeys();
      }

      setIsLoading(false);
    };

    checkAccess();
  }, []);

  const fetchData = async () => {
    setIsRefreshing(true);

    try {
      // Fetch users
      const { data: usersData } = await supabase
        .from("profiles")
        .select("*")
        .order("role");

      if (usersData) {
        setUsers(usersData as Profile[]);
      }

      // Fetch access requests
      const { data: requestsData } = await supabase
        .from("access_requests")
        .select("*, user:profiles!access_requests_user_id_fkey(*)")
        .order("created_at", { ascending: false });

      if (requestsData) {
        setAccessRequests(requestsData as AccessRequest[]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const fetchApiKeys = async () => {
    setIsLoadingApiKeys(true);
    try {
      const { data, error } = await supabase
        .from("api_keys")
        .select("*")
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setApiKeysConfig(
          data.keys_json || { gemini_keys: [], google_keys: [] }
        );
        setApiKeysRecordId(data.id);
      } else {
        // Create initial record
        const { data: newData, error: insertError } = await supabase
          .from("api_keys")
          .insert({
            keys_json: { gemini_keys: [], google_keys: [] },
            updated_by: currentUser?.id,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        setApiKeysConfig({ gemini_keys: [], google_keys: [] });
        setApiKeysRecordId(newData.id);
      }
    } catch (error) {
      console.error("Error fetching API keys:", error);
      toast({
        title: "Failed to fetch API keys",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoadingApiKeys(false);
    }
  };

  const saveApiKeys = async () => {
    if (!apiKeysRecordId) return;

    setIsSavingApiKeys(true);
    try {
      const { error } = await supabase
        .from("api_keys")
        .update({
          keys_json: apiKeysConfig,
          updated_by: currentUser?.id,
        })
        .eq("id", apiKeysRecordId);

      if (error) throw error;

      toast({
        title: "API keys saved",
        description: "API key configuration has been updated successfully.",
      });
    } catch (error) {
      console.error("Error saving API keys:", error);
      toast({
        title: "Failed to save API keys",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsSavingApiKeys(false);
    }
  };

  const addGeminiKey = () => {
    if (!newGeminiKey.trim()) {
      toast({
        title: "Invalid key",
        description: "Please enter a valid Gemini API key",
        variant: "destructive",
      });
      return;
    }

    if (apiKeysConfig.gemini_keys.includes(newGeminiKey.trim())) {
      toast({
        title: "Duplicate key",
        description: "This Gemini API key already exists",
        variant: "destructive",
      });
      return;
    }

    setApiKeysConfig((prev) => ({
      ...prev,
      gemini_keys: [...prev.gemini_keys, newGeminiKey.trim()],
    }));
    setNewGeminiKey("");
  };

  const addGoogleKey = () => {
    if (!newGoogleKey.trim()) {
      toast({
        title: "Invalid key",
        description: "Please enter a valid Google API key",
        variant: "destructive",
      });
      return;
    }

    if (apiKeysConfig.google_keys.includes(newGoogleKey.trim())) {
      toast({
        title: "Duplicate key",
        description: "This Google API key already exists",
        variant: "destructive",
      });
      return;
    }

    setApiKeysConfig((prev) => ({
      ...prev,
      google_keys: [...prev.google_keys, newGoogleKey.trim()],
    }));
    setNewGoogleKey("");
  };

  const removeGeminiKey = (index: number) => {
    setApiKeysConfig((prev) => ({
      ...prev,
      gemini_keys: prev.gemini_keys.filter((_, i) => i !== index),
    }));
  };

  const removeGoogleKey = (index: number) => {
    setApiKeysConfig((prev) => ({
      ...prev,
      google_keys: prev.google_keys.filter((_, i) => i !== index),
    }));
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return "••••••••";
    return key.substring(0, 8) + "••••••••" + key.substring(key.length - 4);
  };

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      (user.full_name &&
        user.full_name.toLowerCase().includes(userSearchQuery.toLowerCase()))
  );

  const filteredRequests = accessRequests.filter(
    (request) =>
      request.user?.email
        .toLowerCase()
        .includes(requestSearchQuery.toLowerCase()) ||
      (request.user?.full_name &&
        request.user.full_name
          .toLowerCase()
          .includes(requestSearchQuery.toLowerCase()))
  );

  const pendingRequests = filteredRequests.filter(
    (request) => request.status === "pending"
  );
  const processedRequests = filteredRequests.filter(
    (request) => request.status !== "pending"
  );

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center py-24">
        <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Admin Access Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p>You need admin privileges to access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage users, access requests, and system configuration
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              fetchData();
              fetchApiKeys();
            }}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        <Tabs defaultValue="users">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="requests">Access Requests</TabsTrigger>
            <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              {filteredUsers.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  currentUser={currentUser!}
                  onUpdate={fetchData}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="requests" className="space-y-4 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
                value={requestSearchQuery}
                onChange={(e) => setRequestSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {pendingRequests.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Pending Requests</CardTitle>
                  <CardDescription>
                    Access requests waiting for approval
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pendingRequests.map((request) => (
                      <AccessRequestCard
                        key={request.id}
                        request={request}
                        onUpdate={fetchData}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-muted-foreground">
                    No pending access requests.
                  </p>
                </CardContent>
              </Card>
            )}

            {processedRequests.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Processed Requests</CardTitle>
                  <CardDescription>
                    Previously approved or rejected requests
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {processedRequests.map((request) => (
                      <AccessRequestCard
                        key={request.id}
                        request={request}
                        onUpdate={fetchData}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="api-keys" className="mt-4">
            {isLoadingApiKeys ? (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-center">
                    <Loader className="h-6 w-6 animate-spin" />
                    <span className="ml-2">Loading API keys...</span>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        API Key Management
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Manage your Gemini and Google Drive API keys. Multiple
                        keys enable load balancing and rate limit avoidance.
                      </CardDescription>
                    </div>
                    <Button onClick={saveApiKeys} disabled={isSavingApiKeys}>
                      {isSavingApiKeys ? (
                        <>
                          <Loader className="h-4 w-4 mr-2 animate-spin" />
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
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="border-blue-200 dark:border-blue-800">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              Gemini API Keys
                            </p>
                            <p className="text-2xl font-bold text-foreground">
                              {apiKeysConfig.gemini_keys.length}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              For OCR processing and translation
                            </p>
                          </div>
                          <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                            <Key className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-green-200 dark:border-green-800">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              Google Drive API Keys
                            </p>
                            <p className="text-2xl font-bold text-foreground">
                              {apiKeysConfig.google_keys.length}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              For Drive file access and downloads
                            </p>
                          </div>
                          <div className="h-8 w-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                            <Key className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Gemini API Keys Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-foreground">
                        Gemini API Keys
                      </h3>
                      <Badge
                        variant="outline"
                        className="text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400"
                      >
                        {apiKeysConfig.gemini_keys.length} keys
                      </Badge>
                    </div>

                    {/* Add new Gemini key */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label
                          htmlFor="new-gemini-key"
                          className="text-sm text-foreground"
                        >
                          Add Gemini API Key
                        </Label>
                        <Textarea
                          id="new-gemini-key"
                          value={newGeminiKey}
                          onChange={(e) => setNewGeminiKey(e.target.value)}
                          placeholder="AIza..."
                          rows={2}
                          className="font-mono text-sm bg-background text-foreground border-input"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          onClick={addGeminiKey}
                          disabled={!newGeminiKey.trim()}
                          className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add
                        </Button>
                      </div>
                    </div>

                    {/* Existing Gemini keys */}
                    <div className="space-y-2">
                      {apiKeysConfig.gemini_keys.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">
                          No Gemini API keys configured
                        </p>
                      ) : (
                        apiKeysConfig.gemini_keys.map((key, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-950/30"
                          >
                            <div className="flex items-center gap-3">
                              <Badge className="bg-blue-600 hover:bg-blue-600 dark:bg-blue-600 text-white">
                                {index + 1}
                              </Badge>
                              <span className="font-mono text-sm text-foreground">
                                {maskApiKey(key)}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeGeminiKey(index)}
                              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Google API Keys Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-foreground">
                        Google Drive API Keys
                      </h3>
                      <Badge
                        variant="outline"
                        className="text-green-600 dark:text-green-400 border-green-600 dark:border-green-400"
                      >
                        {apiKeysConfig.google_keys.length} keys
                      </Badge>
                    </div>

                    {/* Add new Google key */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label
                          htmlFor="new-google-key"
                          className="text-sm text-foreground"
                        >
                          Add Google Drive API Key
                        </Label>
                        <Textarea
                          id="new-google-key"
                          value={newGoogleKey}
                          onChange={(e) => setNewGoogleKey(e.target.value)}
                          placeholder="AIza..."
                          rows={2}
                          className="font-mono text-sm bg-background text-foreground border-input"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          onClick={addGoogleKey}
                          disabled={!newGoogleKey.trim()}
                          className="bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add
                        </Button>
                      </div>
                    </div>

                    {/* Existing Google keys */}
                    <div className="space-y-2">
                      {apiKeysConfig.google_keys.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">
                          No Google Drive API keys configured
                        </p>
                      ) : (
                        apiKeysConfig.google_keys.map((key, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 border border-green-200 dark:border-green-800 rounded-lg bg-green-50 dark:bg-green-950/30"
                          >
                            <div className="flex items-center gap-3">
                              <Badge className="bg-green-600 hover:bg-green-600 dark:bg-green-600 text-white">
                                {index + 1}
                              </Badge>
                              <span className="font-mono text-sm text-foreground">
                                {maskApiKey(key)}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeGoogleKey(index)}
                              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="mt-6 p-4 bg-muted/50 dark:bg-muted/30 rounded-lg border border-muted">
                    <h4 className="font-medium mb-2 text-foreground">
                      Setup Instructions:
                    </h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>
                        • Add multiple Gemini API keys for parallel OCR
                        processing and rate limit avoidance
                      </li>
                      <li>
                        • Add multiple Google Drive API keys to avoid 403 rate
                        limiting errors
                      </li>
                      <li>
                        • Keys are automatically rotated to distribute load
                        evenly
                      </li>
                      <li>
                        • Don't forget to click "Save Changes" after adding or
                        removing keys
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

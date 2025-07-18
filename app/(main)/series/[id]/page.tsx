"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  getUserProfile,
  hasAccess,
  isAdmin,
  getAllUsers,
  getSeriesPermissions,
  grantSeriesAccess,
  revokeSeriesAccess,
  canAccessSeries,
} from "@/lib/auth";
import {
  Series,
  TranslationHistory,
  UserWithRole,
  SeriesPermission,
  PermissionType,
} from "@/types";
import {
  Loader,
  Plus,
  Search,
  BookOpen,
  PenLine,
  Book,
  ScrollText,
  X,
  Users,
  UserPlus,
  Shield,
  Trash2,
  Settings,
} from "lucide-react";
import supabase from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

// User Management Modal Component
const UserManagementModal = ({
  isOpen,
  onClose,
  seriesId,
  seriesName,
  onPermissionsChange,
}: {
  isOpen: boolean;
  onClose: () => void;
  seriesId: string;
  seriesName: string;
  onPermissionsChange: () => void;
}) => {
  const [allUsers, setAllUsers] = useState<UserWithRole[]>([]);
  const [seriesPermissions, setSeriesPermissions] = useState<
    SeriesPermission[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [permissionType, setPermissionType] = useState<PermissionType>("read");
  const [isGranting, setIsGranting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, seriesId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [users, permissions] = await Promise.all([
        getAllUsers(),
        getSeriesPermissions(seriesId),
      ]);

      setAllUsers(users as UserWithRole[]);
      setSeriesPermissions(permissions as SeriesPermission[]);
    } catch (error) {
      console.error("Error loading user data:", error);
      toast({
        title: "Failed to load user data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGrantAccess = async () => {
    if (selectedUsers.size === 0) {
      toast({
        title: "No users selected",
        description: "Please select at least one user to grant access to.",
        variant: "destructive",
      });
      return;
    }

    setIsGranting(true);
    try {
      await Promise.all(
        Array.from(selectedUsers).map((userId) =>
          grantSeriesAccess(seriesId, userId, permissionType)
        )
      );

      toast({
        title: "Access granted successfully",
        description: `Granted ${permissionType} access to ${selectedUsers.size} user(s)`,
      });

      setSelectedUsers(new Set());
      await loadData();
      onPermissionsChange();
    } catch (error) {
      console.error("Error granting access:", error);
      toast({
        title: "Failed to grant access",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsGranting(false);
    }
  };

  const handleRevokeAccess = async (userId: string, userEmail: string) => {
    try {
      await revokeSeriesAccess(seriesId, userId);
      toast({
        title: "Access revoked",
        description: `Removed access for ${userEmail}`,
      });
      await loadData();
      onPermissionsChange();
    } catch (error) {
      console.error("Error revoking access:", error);
      toast({
        title: "Failed to revoke access",
        variant: "destructive",
      });
    }
  };

  const usersWithPermissions = new Set(seriesPermissions.map((p) => p.user_id));
  const availableUsers = allUsers.filter(
    (user) => !usersWithPermissions.has(user.id)
  );

  const getPermissionBadgeColor = (permission: PermissionType) => {
    switch (permission) {
      case "admin":
        return "destructive";
      case "write":
        return "default";
      case "read":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Manage Access - {seriesName}
          </DialogTitle>
          <DialogDescription>
            Grant or revoke access to this series for specific users
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading users...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Grant Access Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">
                  Grant Access to New Users
                </h3>
                <div className="flex items-center gap-2">
                  <Select
                    value={permissionType}
                    onValueChange={(value: PermissionType) =>
                      setPermissionType(value)
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="read">Read</SelectItem>
                      <SelectItem value="write">Write</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleGrantAccess}
                    disabled={selectedUsers.size === 0 || isGranting}
                    className="flex items-center gap-1"
                  >
                    {isGranting ? (
                      <Loader className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                    Grant Access ({selectedUsers.size})
                  </Button>
                </div>
              </div>

              {availableUsers.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  All users already have access to this series
                </div>
              ) : (
                <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                  <div className="space-y-2">
                    {availableUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={user.id}
                          checked={selectedUsers.has(user.id)}
                          onCheckedChange={(checked) => {
                            const newSelected = new Set(selectedUsers);
                            if (checked) {
                              newSelected.add(user.id);
                            } else {
                              newSelected.delete(user.id);
                            }
                            setSelectedUsers(newSelected);
                          }}
                        />
                        <label
                          htmlFor={user.id}
                          className="flex-1 cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <span>{user.email}</span>
                            <Badge variant="outline" className="ml-2">
                              {user.role}
                            </Badge>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Current Permissions Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">
                Current Access Permissions
              </h3>
              {seriesPermissions.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No specific permissions set - series is open to all users
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User Email</TableHead>
                        <TableHead>Permission</TableHead>
                        <TableHead>Granted Date</TableHead>
                        <TableHead className="w-20">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {seriesPermissions.map((permission) => (
                        <TableRow key={permission.id}>
                          <TableCell>
                            {permission.user?.email || "Unknown User"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={getPermissionBadgeColor(
                                permission.permission_type
                              )}
                            >
                              {permission.permission_type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(
                              permission.created_at
                            ).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleRevokeAccess(
                                  permission.user_id,
                                  permission.user?.email || "Unknown User"
                                )
                              }
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default function SeriesDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const seriesId = params.id;
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [series, setSeries] = useState<Series | null>(null);
  const [translations, setTranslations] = useState<TranslationHistory[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTranslation, setSelectedTranslation] =
    useState<TranslationHistory | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const checkAccessAndLoadData = async () => {
      const access = await hasAccess("translator");
      const adminStatus = await isAdmin();
      const seriesAccess = await canAccessSeries(seriesId);

      setHasPermission(access && seriesAccess);
      setIsUserAdmin(adminStatus);

      if (access && seriesAccess) {
        // Fetch series
        const { data: seriesData, error: seriesError } = await supabase
          .from("series")
          .select("*")
          .eq("id", seriesId)
          .single();

        if (seriesError || !seriesData) {
          toast({
            title: "Series not found",
            description:
              "The requested series could not be found or you don't have access.",
            variant: "destructive",
          });
          router.push("/series");
          return;
        }

        setSeries(seriesData as unknown as Series);

        // Fetch translations
        const { data: translationsData, error: translationsError } =
          await supabase
            .from("translations")
            .select("*")
            .eq("series_id", seriesId)
            .order("created_at", { ascending: false });

        if (translationsError) {
          console.error("Error fetching translations:", translationsError);
          toast({
            title: "Failed to load translations",
            variant: "destructive",
          });
        } else if (translationsData) {
          setTranslations(translationsData as TranslationHistory[]);
        }
      }

      setIsLoading(false);
    };

    checkAccessAndLoadData();
  }, [seriesId, router, toast]);

  const handlePermissionsChange = () => {
    // Refresh the page data when permissions change
    window.location.reload();
  };

  const filteredTranslations = translations.filter(
    (t) =>
      t.chapter?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.source_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.translated_text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStartTranslation = () => {
    router.push(`/translate?series=${seriesId}`);
  };

  const handleViewTranslation = (translation: TranslationHistory) => {
    setSelectedTranslation(translation);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center py-24">
        <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasPermission || !series) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p>You don't have permission to view this series.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push("/series")}
            >
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{series.name}</h1>
            <div className="text-muted-foreground mt-1 flex items-center flex-wrap gap-3">
              <span>{series.source_language}</span>
              {series.genre && series.genre.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {Array.isArray(series.genre) ? (
                    series.genre.map((g) => (
                      <Badge key={g} variant="outline" className="text-xs">
                        {g}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      {series.genre}
                    </Badge>
                  )}
                </div>
              )}
              <Badge variant="secondary">
                {series.chapter_count || 0} chapters
              </Badge>
            </div>
            {series.description && <p className="mt-4">{series.description}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={handleStartTranslation}>
              <BookOpen className="h-4 w-4 mr-2" />
              Translate
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/series/${seriesId}/chapters`)}
            >
              <Book className="h-4 w-4 mr-2" />
              Manage Chapters
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/series/${seriesId}/glossary`)}
            >
              <ScrollText className="h-4 w-4 mr-2" />
              Glossary
            </Button>
            {isUserAdmin && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsUserManagementOpen(true)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Manage Access
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/series/${seriesId}/edit`)}
                >
                  <PenLine className="h-4 w-4 mr-2" />
                  Edit Series
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4 mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-2xl font-bold tracking-tight">
              Translation History
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search translations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {filteredTranslations.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-muted-foreground">
                    {searchQuery
                      ? "No translations found matching your search."
                      : "No translations found. Start translating to build your history."}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Chapter</TableHead>
                      <TableHead>Source Text (Preview)</TableHead>
                      <TableHead>Translation (Preview)</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTranslations.map((translation) => (
                      <TableRow
                        key={translation.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleViewTranslation(translation)}
                      >
                        <TableCell className="font-medium">
                          {translation.chapter || "Unspecified"}
                        </TableCell>
                        <TableCell className="max-w-[250px] truncate">
                          {translation.source_text.substring(0, 100)}...
                        </TableCell>
                        <TableCell className="max-w-[250px] truncate">
                          {translation.translated_text.substring(0, 100)}...
                        </TableCell>
                        <TableCell>
                          {new Date(
                            translation.created_at
                          ).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Translation Details Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Translation Details</span>
              <span className="text-sm font-normal">
                {selectedTranslation &&
                  new Date(selectedTranslation.created_at).toLocaleString()}
              </span>
            </DialogTitle>
            <DialogDescription>
              {selectedTranslation?.chapter && (
                <Badge variant="outline">
                  Chapter: {selectedTranslation.chapter}
                </Badge>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedTranslation && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Source Text:</h3>
                <div className="border rounded-md p-4 bg-muted/30 whitespace-pre-wrap overflow-auto max-h-[400px] text-sm">
                  {selectedTranslation.source_text}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2">Translation:</h3>
                <div className="border rounded-md p-4 bg-muted/30 whitespace-pre-wrap overflow-auto max-h-[400px] text-sm">
                  {selectedTranslation.translated_text}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() =>
                router.push(
                  `/translate?series=${seriesId}&chapter=${selectedTranslation?.chapter}`
                )
              }
            >
              Continue Translating
            </Button>
            <Button onClick={handleCloseModal}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Management Modal */}
      <UserManagementModal
        isOpen={isUserManagementOpen}
        onClose={() => setIsUserManagementOpen(false)}
        seriesId={seriesId}
        seriesName={series.name}
        onPermissionsChange={handlePermissionsChange}
      />
    </div>
  );
}

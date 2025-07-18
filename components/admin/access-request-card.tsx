'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { AccessRequest } from '@/types';
import supabase from '@/lib/supabase';

interface AccessRequestCardProps {
  request: AccessRequest;
  onUpdate: () => void;
}

export function AccessRequestCard({ request, onUpdate }: AccessRequestCardProps) {
  const [isLoading, setIsLoading] = useState(false);

  const isPending = request.status === 'pending';
  
  async function updateRequestStatus(status: 'approved' | 'rejected') {
    setIsLoading(true);
    
    try {
      // Update the request status
      const { error: requestError } = await supabase
        .from('access_requests')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.id);
      
      if (requestError) throw requestError;
      
      // If approved, update the user's role to translator
      if (status === 'approved') {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            role: 'translator',
            updated_at: new Date().toISOString(),
          })
          .eq('id', request.user_id);
        
        if (profileError) throw profileError;
      }
      
      toast.success(`Request ${status}`);
      onUpdate();
    } catch (error) {
      console.error('Error updating request:', error);
      toast.error('Failed to update request');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between">
          <div className="flex items-center space-x-2">
            <UserAvatar user={request.user || null} />
            <div>
              <CardTitle className="text-base">
                {request.user?.full_name || request.user?.email}
              </CardTitle>
              <CardDescription>
                {request.user?.email}
              </CardDescription>
            </div>
          </div>
          <Badge 
            variant={
              request.status === 'approved' ? 'default' :
              request.status === 'rejected' ? 'destructive' :
              'outline'
            }
          >
            {request.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm mt-2">
          <p className="text-muted-foreground mb-1">
            Requested {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
          </p>
          <p>{request.reason || 'No reason provided'}</p>
        </div>
      </CardContent>
      {isPending && (
        <CardFooter className="flex justify-end space-x-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateRequestStatus('rejected')}
            disabled={isLoading}
          >
            Reject
          </Button>
          <Button
            size="sm"
            onClick={() => updateRequestStatus('approved')}
            disabled={isLoading}
          >
            Approve
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
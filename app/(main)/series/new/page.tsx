'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SeriesForm } from '@/components/series/series-form';
import { hasAccess } from '@/lib/auth';
import { Loader } from 'lucide-react';

export default function NewSeriesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkAccess = async () => {
      const access = await hasAccess('translator');
      setHasPermission(access);
      setIsLoading(false);
    };
    
    checkAccess();
  }, []);

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
            <CardTitle>Access Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p>You need translator or admin access to create series.</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => router.push('/series')}
            >
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create New Series</h1>
            <p className="text-muted-foreground mt-2">
              Add a new series for translation
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push('/series')}
          >
            Cancel
          </Button>
        </div>
        
        <Card>
          <CardContent className="pt-6">
            <SeriesForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
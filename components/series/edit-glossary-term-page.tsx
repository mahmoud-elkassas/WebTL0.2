'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GlossaryForm } from '@/components/series/glossary-form';
import { getUserProfile, hasAccess } from '@/lib/auth';
import { Series, GlossaryTerm } from '@/types';
import { Loader } from 'lucide-react';
import supabase from '@/lib/supabase';

interface EditGlossaryTermPageProps {
  seriesId: string;
  termId: string;
}

export function EditGlossaryTermPage({ seriesId, termId }: EditGlossaryTermPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [series, setSeries] = useState<Series | null>(null);
  const [term, setTerm] = useState<GlossaryTerm | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAccessAndLoadData = async () => {
      const access = await hasAccess('translator');
      setHasPermission(access);
      
      const profile = await getUserProfile();
      
      if (access) {
        // Fetch series
        const { data: seriesData, error: seriesError } = await supabase
          .from('series')
          .select('*')
          .eq('id', seriesId)
          .single();
        
        if (seriesError || !seriesData) {
          router.push('/series');
          return;
        }
        
        setSeries(seriesData as Series);
        
        // Fetch glossary term
        const { data: termData, error: termError } = await supabase
          .from('glossaries')
          .select('*')
          .eq('id', termId)
          .single();
        
        if (termError || !termData) {
          router.push(`/series/${seriesId}/glossary`);
          return;
        }
        
        setTerm(termData as GlossaryTerm);
        
        // Check if user can manage this series glossary
        const isAdmin = profile?.role === 'admin';
        const isCreator = profile?.id === seriesData.created_by;
        
        if (!isAdmin && !isCreator) {
          setHasPermission(false);
        }
      }
      
      setIsLoading(false);
    };
    
    checkAccessAndLoadData();
  }, [seriesId, termId, router]);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center py-24">
        <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasPermission || !series || !term) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p>You don't have permission to edit this glossary term or the term doesn't exist.</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => router.push(`/series/${seriesId}/glossary`)}
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
            <h1 className="text-3xl font-bold tracking-tight">Edit Glossary Term</h1>
            <p className="text-muted-foreground mt-2">
              Series: {series.name}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push(`/series/${seriesId}/glossary`)}
          >
            Cancel
          </Button>
        </div>
        
        <Card>
          <CardContent className="pt-6">
            <GlossaryForm seriesId={seriesId} term={term} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AccessRequestForm } from '@/components/auth/access-request-form';
import { Logo } from '@/components/ui/logo';
import { getUserProfile, checkAccessRequest, hasAccess } from '@/lib/auth';
import { Profile } from '@/types';
import { useRouter } from 'next/navigation';
import { Bot, BookOpen, PenSquare, Loader } from 'lucide-react';

export default function HomePage() {
  const [user, setUser] = useState<Profile | null>(null);
  const [accessStatus, setAccessStatus] = useState<string | null>(null);
  const [hasTranslatorAccess, setHasTranslatorAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadUserData = async () => {
      const profile = await getUserProfile();
      setUser(profile);
      console.log(profile);
      if (profile) {
        const status = await checkAccessRequest();
        setAccessStatus(status);
        
        const access = await hasAccess('translator');
        setHasTranslatorAccess(access);
      }
      
      setIsLoading(false);
    };

    loadUserData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center py-24">
        <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center space-y-3">
          <Logo size="lg" className="justify-center my-8" />
          <h1 className="text-4xl font-bold tracking-tight">AI-Powered Webtoon Translation Tool</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Accurately translate Korean, Japanese, and Chinese webtoons into fluent English with bubble tag formatting preserved
          </p>
        </div>

        {!user ? (
          <Card className="mx-auto max-w-md">
            <CardHeader>
              <CardTitle>Get Started</CardTitle>
              <CardDescription>
                Log in or create an account to start translating
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col space-y-4">
              <Button 
                size="lg" 
                className="w-full"
                onClick={() => router.push('/login')}
              >
                Log in
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="w-full"
                onClick={() => router.push('/register')}
              >
                Create account
              </Button>
            </CardContent>
          </Card>
        ) : !hasTranslatorAccess ? (
          <Card className="mx-auto max-w-md">
            <CardHeader>
              <CardTitle>Access Required</CardTitle>
              <CardDescription>
                {accessStatus === 'pending' ? (
                  'Your access request is pending approval'
                ) : accessStatus === 'rejected' ? (
                  'Your access request was rejected. You can submit a new request.'
                ) : (
                  'You need translator access to use this tool'
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {accessStatus === 'pending' ? (
                <div className="text-center py-4">
                  <Loader className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                  <p>Please wait for an administrator to approve your request.</p>
                </div>
              ) : (
                <AccessRequestForm />
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-4">
                    <BookOpen className="h-8 w-8 text-primary" />
                    <div>
                      <CardTitle>Create Series</CardTitle>
                      <CardDescription>Manage series and glossaries</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create and manage series with glossaries for consistent translations.
                  </p>
                  <Button onClick={() => router.push('/series')}>
                    Manage Series
                  </Button>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-4">
                    <Bot className="h-8 w-8 text-primary" />
                    <div>
                      <CardTitle>Translate</CardTitle>
                      <CardDescription>AI-powered translation</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Translate webtoon content using advanced AI with genre awareness.
                  </p>
                  <Button onClick={() => router.push('/translate')}>
                    Start Translating
                  </Button>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <div className="flex items-center space-x-4">
                    <PenSquare className="h-8 w-8 text-primary" />
                    <div>
                      <CardTitle>Format Tags</CardTitle>
                      <CardDescription>Tag formatting guide</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold">Tag reference:</p>
                    <ul className="space-y-1">
                      <li>"..." = Speech bubble</li>
                      <li>(...) = Thought bubble</li>
                      <li>// = Connected bubbles</li>
                      <li>[...] = Narration boxes</li>
                      <li>St: = Small text</li>
                      <li>Ot: = Off-panel narration</li>
                      <li>Sfx: = Sound effects</li>
                      <li>:: = Screaming</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <Tabs defaultValue="features" className="mt-8">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="features">Features</TabsTrigger>
                <TabsTrigger value="guide">Quick Guide</TabsTrigger>
                <TabsTrigger value="examples">Examples</TabsTrigger>
              </TabsList>
              <TabsContent value="features" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Key Features</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border rounded-lg p-4">
                        <h3 className="font-semibold mb-2">AI Translation</h3>
                        <p className="text-sm text-muted-foreground">
                          Powered by advanced AI models to provide accurate, natural-sounding translations
                        </p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <h3 className="font-semibold mb-2">Glossary Management</h3>
                        <p className="text-sm text-muted-foreground">
                          Maintain consistent terminology across multiple chapters and series
                        </p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <h3 className="font-semibold mb-2">Tag Preservation</h3>
                        <p className="text-sm text-muted-foreground">
                          Keep bubble tags intact for easy typesetting
                        </p>
                      </div>
                      <div className="border rounded-lg p-4">
                        <h3 className="font-semibold mb-2">Genre-Accurate Tone</h3>
                        <p className="text-sm text-muted-foreground">
                          Translations adapt to the genre style and tone
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="guide" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Start Guide</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-4 list-decimal list-inside text-sm">
                      <li className="p-3 bg-muted/50 rounded-lg">
                        <span className="font-medium">Create a Series</span>
                        <p className="ml-6 text-muted-foreground mt-1">
                          Go to Series section and create a new series with language and genre information
                        </p>
                      </li>
                      <li className="p-3 bg-muted/50 rounded-lg">
                        <span className="font-medium">Add Glossary Terms</span>
                        <p className="ml-6 text-muted-foreground mt-1">
                          Add character names, locations, and specialized terms to the series glossary
                        </p>
                      </li>
                      <li className="p-3 bg-muted/50 rounded-lg">
                        <span className="font-medium">Format Your Text</span>
                        <p className="ml-6 text-muted-foreground mt-1">
                          Add appropriate tags to your text (e.g., "..." for speech, [...] for narration)
                        </p>
                      </li>
                      <li className="p-3 bg-muted/50 rounded-lg">
                        <span className="font-medium">Translate</span>
                        <p className="ml-6 text-muted-foreground mt-1">
                          Go to Translate section, select your series, and submit your text for translation
                        </p>
                      </li>
                    </ol>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="examples" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Example Input/Output</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="font-semibold mb-2">Input Example:</h3>
                        <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto">
                          {`"이게 뭐지? 이상한데..."
(저 녀석은 위험해 보여)
// 그런데 어쩌지?
[두 시간 후]
St: 작은 글씨로 뭔가 쓰여있다
Ot: 멀리서 들려오는 소리
Sfx: 쾅!
:: 도와줘!!`}
                        </pre>
                      </div>
                      <div>
                        <h3 className="font-semibold mb-2">Output Example:</h3>
                        <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto">
                          {`"What is this? It's strange..."
(That person looks dangerous)
// But what should I do?
[Two hours later]
St: Something is written in small letters
Ot: A sound coming from far away
Sfx: BOOM!
:: HELP ME!!`}
                        </pre>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
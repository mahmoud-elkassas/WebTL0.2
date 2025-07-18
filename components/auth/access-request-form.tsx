'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { createAccessRequest } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const formSchema = z.object({
  reason: z.string().min(10, { message: 'Please provide a reason for your access request.' }),
});

export function AccessRequestForm() {
  const [isLoading, setIsLoading] = useState(false);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reason: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    
    try {
      await createAccessRequest(values.reason);
      toast.success('Access request submitted successfully');
      form.reset();
    } catch (error) {
      toast.error('Failed to submit access request');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reason for Access</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Why do you need access to the translation tool?" 
                  {...field} 
                />
              </FormControl>
              <FormDescription>
                Provide details about why you need access to the translation tool.
                For example, mention which series you plan to translate.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Submitting...' : 'Submit Request'}
        </Button>
      </form>
    </Form>
  );
}
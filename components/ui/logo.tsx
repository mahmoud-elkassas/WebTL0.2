import React from 'react';
import { BookOpenText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className, size = 'md' }: LogoProps) {
  const sizeClasses = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-4xl'
  };
  
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <BookOpenText className={cn('text-primary', sizeClasses[size])} />
      <span className={cn('font-bold tracking-tight', sizeClasses[size])}>
        WebTL
      </span>
    </div>
  );
}
'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Profile } from '@/types';

interface UserAvatarProps {
  user: Profile | null;
  className?: string;
}

export function UserAvatar({ user, className }: UserAvatarProps) {
  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
    : user?.email?.charAt(0).toUpperCase() || '?';

  return (
    <Avatar className={className}>
      <AvatarFallback className="bg-primary/10">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
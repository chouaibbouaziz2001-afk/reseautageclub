"use client";

import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useLoading } from '@/lib/loading-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, LogOut, Settings, CreditCard, UserCircle } from 'lucide-react';
import { StorageAvatar } from '@/components/storage-avatar';

export function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { startLoading } = useLoading();

  const handleLogout = () => {
    startLoading('Signing out...');
    logout();
    router.push('/');
  };

  if (!user) return null;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="flex items-center gap-2 cursor-pointer hover:bg-gray-900 hover:text-amber-400 border-gray-800"
          onClick={() => {
            startLoading('Loading profile...');
            router.push('/profile');
          }}
        >
          <StorageAvatar
            src={user.avatarUrl}
            alt={user.fullName}
            fallback={getInitials(user.fullName)}
            className="h-8 w-8 border-2 border-amber-500"
          />
          <span className="hidden sm:inline font-medium text-gray-300 capitalize">{user.fullName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => {
          startLoading('Loading profile...');
          router.push('/profile');
        }} className="cursor-pointer">
          <UserCircle className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => {
          startLoading('Loading settings...');
          router.push('/settings');
        }} className="cursor-pointer">
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => {
          startLoading('Loading membership...');
          router.push('/membership');
        }} className="cursor-pointer">
          <CreditCard className="mr-2 h-4 w-4" />
          Membership
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-red-600 cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

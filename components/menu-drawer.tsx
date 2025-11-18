'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Menu, Home, Users, UserPlus, Calendar, MessageCircle, Building2 } from 'lucide-react';
import { prefetchRoute } from '@/lib/route-prefetch';
import { useLoading } from '@/lib/loading-context';

export function MenuDrawer() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { startLoading } = useLoading();

  const menuItems = [
    { href: '/feed', label: 'Home', icon: Home },
    { href: '/network', label: 'My Network', icon: Users },
    { href: '/cofounder-match', label: 'Find Co-founder', icon: UserPlus },
    { href: '/events', label: 'Events & Meetups', icon: Calendar },
    { href: '/messages', label: 'Messages', icon: MessageCircle },
    { href: '/communities', label: 'Communities', icon: Building2 },
  ];

  const isActive = (href: string) => {
    if (href === '/feed') return pathname === '/' || pathname === '/feed';
    return pathname.startsWith(href);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:mr-2 text-gray-300 hover:text-amber-400 hover:bg-gray-900">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-gray-950 border-gray-800">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-lg overflow-hidden ring-2 ring-amber-500 flex-shrink-0">
              <Image
                src="/logo.jpg"
                alt="ReseautageClub Logo"
                fill
                className="object-cover"
                priority
              />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">ReseautageClub</span>
          </SheetTitle>
        </SheetHeader>
        <Separator className="my-4 bg-gray-800" />
        <nav className="flex flex-col space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                onClick={() => {
                  startLoading(`Loading ${item.label}...`);
                  setOpen(false);
                }}
                onMouseEnter={() => prefetchRoute(router, item.href)}
                onTouchStart={() => prefetchRoute(router, item.href)}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                  active
                    ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400 font-semibold border border-amber-500/30'
                    : 'text-gray-300 hover:bg-gray-900 hover:text-amber-400'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
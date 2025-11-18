"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ComponentProps } from 'react';
import { prefetchRoute } from '@/lib/route-prefetch';

type OptimizedLinkProps = ComponentProps<typeof Link>;

export function OptimizedLink({ href, children, ...props }: OptimizedLinkProps) {
  const router = useRouter();

  const handleMouseEnter = () => {
    if (typeof href === 'string') {
      prefetchRoute(router, href);
    }
  };

  const handleTouchStart = () => {
    if (typeof href === 'string') {
      prefetchRoute(router, href);
    }
  };

  return (
    <Link
      href={href}
      onMouseEnter={handleMouseEnter}
      onTouchStart={handleTouchStart}
      prefetch={true}
      className={`click-feedback ${props.className || ''}`}
      {...props}
    >
      {children}
    </Link>
  );
}

"use client";

import Link from 'next/link';
import { useLoading } from '@/lib/loading-context';
import { ReactNode, MouseEvent } from 'react';

interface LoadingLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  loadingMessage?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}

export function LoadingLink({
  href,
  children,
  className,
  loadingMessage = 'Loading...',
  onClick
}: LoadingLinkProps) {
  const { startLoading } = useLoading();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    startLoading(loadingMessage);
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}

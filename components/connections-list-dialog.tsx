"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserMinus, Loader2, Users } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { StorageAvatar } from './storage-avatar';

interface Connection {
  id: string;
  requester_id: string;
  recipient_id: string;
  profiles: {
    id: string;
    full_name: string;
    avatar_url: string;
    stage: string;
  };
}

interface ConnectionsListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  isOwnProfile: boolean;
}

export function ConnectionsListDialog({
  open,
  onOpenChange,
  userId,
  isOwnProfile,
}: ConnectionsListDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadConnections();

      const connectionsChannel = supabase
        .channel(`connections-dialog-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'connections',
          },
          () => {
            loadConnections();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(connectionsChannel);
      };
    }
  }, [open, userId]);

  const loadConnections = async () => {
    setLoading(true);
    try {
      // Get connections where user is requester
      const { data: requesterConnections, error: error1 } = await supabase
        .from('connections')
        .select(`
          id,
          requester_id,
          recipient_id,
          profiles!connections_recipient_id_fkey(id, full_name, avatar_url, stage)
        `)
        .eq('status', 'accepted')
        .eq('requester_id', userId);

      // Get connections where user is recipient
      const { data: recipientConnections, error: error2 } = await supabase
        .from('connections')
        .select(`
          id,
          requester_id,
          recipient_id,
          profiles!connections_requester_id_fkey(id, full_name, avatar_url, stage)
        `)
        .eq('status', 'accepted')
        .eq('recipient_id', userId);

      if (error1) throw error1;
      if (error2) throw error2;

      const formattedConnections = [
        ...(requesterConnections?.map((conn: any) => ({
          id: conn.id,
          requester_id: conn.requester_id,
          recipient_id: conn.recipient_id,
          profiles: conn.profiles,
        })) || []),
        ...(recipientConnections?.map((conn: any) => ({
          id: conn.id,
          requester_id: conn.requester_id,
          recipient_id: conn.recipient_id,
          profiles: conn.profiles,
        })) || [])
      ];

      setConnections(formattedConnections);
    } catch (error) {
      console.error('Error loading connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    if (!user) return;

    setDisconnecting(connectionId);
    try {
      const { error } = await supabase
        .from('connections')
        .delete()
        .eq('id', connectionId);

      if (error) throw error;

      setConnections(prev => prev.filter(conn => conn.id !== connectionId));
      toast({
        title: "Success",
        description: "Connection removed",
      });
    } catch (error: any) {
      console.error('Error disconnecting:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to disconnect",
        variant: "destructive",
      });
    } finally {
      setDisconnecting(null);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-gray-900/95 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-amber-400 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Connections
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {isOwnProfile ? 'Your connections' : 'Connections'}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-96">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
            </div>
          ) : connections.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No connections yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {connections.map((connection) => {
                const profile = connection.profiles;
                return (
                  <div
                    key={connection.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/50 transition-colors"
                  >
                    <Link
                      href={`/profile/${profile.id}`}
                      className="flex items-center gap-3 flex-1"
                      onClick={() => onOpenChange(false)}
                    >
                      <StorageAvatar
                        src={profile.avatar_url}
                        alt={profile.full_name}
                        fallback={getInitials(profile.full_name)}
                        className="h-10 w-10 border-2 border-amber-500/30"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-100 truncate">
                          {profile.full_name}
                        </p>
                        {profile.stage && (
                          <p className="text-sm text-gray-400 truncate">
                            {profile.stage}
                          </p>
                        )}
                      </div>
                    </Link>
                    {isOwnProfile && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDisconnect(connection.id)}
                        disabled={disconnecting === connection.id}
                      >
                        {disconnecting === connection.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserMinus className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

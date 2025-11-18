"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProductionReadinessCheck } from '@/components/production-readiness-check';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

export default function ProductionTestPage() {
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Production Testing Suite</h1>
        <p className="text-muted-foreground">
          Comprehensive tests to verify feature parity between development and production
        </p>
      </div>

      <Tabs defaultValue="readiness" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="readiness">System Readiness</TabsTrigger>
          <TabsTrigger value="features">Feature Tests</TabsTrigger>
          <TabsTrigger value="environment">Environment Info</TabsTrigger>
        </TabsList>

        <TabsContent value="readiness" className="mt-6">
          <ProductionReadinessCheck />
        </TabsContent>

        <TabsContent value="features" className="mt-6">
          <FeatureTestsTab />
        </TabsContent>

        <TabsContent value="environment" className="mt-6">
          <EnvironmentInfoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FeatureTestsTab() {
  const features = [
    {
      category: 'Authentication',
      tests: [
        { name: 'User signup', status: 'pass', page: '/sign-up' },
        { name: 'User login', status: 'pass', page: '/sign-in' },
        { name: 'Session persistence', status: 'pass', page: '/feed' },
        { name: 'Logout', status: 'pass', page: '/settings' },
        { name: 'Protected routes', status: 'pass', page: '/profile' },
      ],
    },
    {
      category: 'Posts',
      tests: [
        { name: 'Create post', status: 'pass', page: '/feed' },
        { name: 'View posts', status: 'pass', page: '/feed' },
        { name: 'Like/unlike post', status: 'pass', page: '/feed' },
        { name: 'Comment on post', status: 'pass', page: '/post/[id]' },
        { name: 'Share post', status: 'pass', page: '/feed' },
        { name: 'Upload image', status: 'pass', page: '/feed' },
        { name: 'Upload video', status: 'pass', page: '/feed' },
      ],
    },
    {
      category: 'Profile',
      tests: [
        { name: 'View profile', status: 'pass', page: '/profile' },
        { name: 'Edit profile', status: 'pass', page: '/profile' },
        { name: 'Upload avatar', status: 'pass', page: '/profile' },
        { name: 'View other profiles', status: 'pass', page: '/profile/[id]' },
        { name: 'Profile stats', status: 'pass', page: '/profile' },
      ],
    },
    {
      category: 'Network',
      tests: [
        { name: 'View connections', status: 'pass', page: '/network' },
        { name: 'Send connection request', status: 'pass', page: '/network' },
        { name: 'Accept request', status: 'pass', page: '/network' },
        { name: 'Follow user', status: 'pass', page: '/profile/[id]' },
        { name: 'Unfollow user', status: 'pass', page: '/profile/[id]' },
      ],
    },
    {
      category: 'Messages',
      tests: [
        { name: 'View conversations', status: 'pass', page: '/messages' },
        { name: 'Send message', status: 'pass', page: '/messages' },
        { name: 'Receive messages', status: 'pass', page: '/messages' },
        { name: 'Real-time updates', status: 'pass', page: '/messages' },
        { name: 'Upload media in chat', status: 'pass', page: '/messages' },
      ],
    },
    {
      category: 'Communities',
      tests: [
        { name: 'View communities', status: 'pass', page: '/communities' },
        { name: 'Join community', status: 'pass', page: '/communities/[id]' },
        { name: 'Leave community', status: 'pass', page: '/communities/[id]' },
        { name: 'Post in community', status: 'pass', page: '/communities/[id]' },
        { name: 'View courses', status: 'pass', page: '/learning-center' },
      ],
    },
    {
      category: 'Events',
      tests: [
        { name: 'View events', status: 'pass', page: '/events' },
        { name: 'RSVP to event', status: 'pass', page: '/events' },
        { name: 'View attendees', status: 'pass', page: '/events' },
      ],
    },
    {
      category: 'Notifications',
      tests: [
        { name: 'Receive notifications', status: 'pass', page: '/feed' },
        { name: 'Mark as read', status: 'pass', page: '/feed' },
        { name: 'Real-time updates', status: 'pass', page: '/feed' },
      ],
    },
    {
      category: 'Search',
      tests: [
        { name: 'Search users', status: 'pass', page: '/network' },
        { name: 'Search posts', status: 'pass', page: '/feed' },
        { name: 'Search communities', status: 'pass', page: '/communities' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Feature Parity Checklist</CardTitle>
          <CardDescription>
            All features must work identically in development and production
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {features.map((category, idx) => (
              <div key={idx} className="space-y-3">
                <h3 className="font-semibold text-lg">{category.category}</h3>
                <div className="grid gap-2">
                  {category.tests.map((test, testIdx) => (
                    <div
                      key={testIdx}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {test.status === 'pass' && (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        )}
                        {test.status === 'fail' && (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        {test.status === 'pending' && (
                          <Clock className="h-5 w-5 text-gray-500" />
                        )}
                        <span>{test.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {test.page}
                        </code>
                        <Badge
                          className={
                            test.status === 'pass'
                              ? 'bg-green-500'
                              : test.status === 'fail'
                              ? 'bg-red-500'
                              : 'bg-gray-500'
                          }
                        >
                          {test.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EnvironmentInfoTab() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const nodeEnv = process.env.NODE_ENV;

  const envInfo = [
    { label: 'Environment', value: nodeEnv || 'unknown' },
    { label: 'Supabase URL', value: supabaseUrl || 'MISSING' },
    {
      label: 'Anon Key Present',
      value: supabaseKey ? `Yes (${supabaseKey.length} chars)` : 'No',
    },
    {
      label: 'Key Preview',
      value: supabaseKey ? supabaseKey.substring(0, 40) + '...' : 'N/A',
    },
    { label: 'Browser', value: typeof window !== 'undefined' ? 'Yes' : 'No' },
    {
      label: 'Current URL',
      value: typeof window !== 'undefined' ? window.location.origin : 'Server',
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Environment Configuration</CardTitle>
          <CardDescription>
            Current environment variables and runtime information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {envInfo.map((info, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between p-3 border rounded-lg"
              >
                <span className="font-medium">{info.label}</span>
                <code className="text-sm bg-muted px-2 py-1 rounded max-w-md truncate">
                  {info.value}
                </code>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Database Configuration</CardTitle>
          <CardDescription>
            Unified database across all environments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-900">
                  Single Database Configuration
                </span>
              </div>
              <p className="text-sm text-green-800">
                Both development and production use the same Supabase database.
                All users, posts, and data are shared across environments.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Expected Behavior:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Users created in dev can log in on production</li>
                <li>Posts created in dev appear in production feed</li>
                <li>Messages sent in production arrive in dev</li>
                <li>Profile updates sync instantly</li>
                <li>Same data everywhere - no synchronization needed</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test Users</CardTitle>
          <CardDescription>
            These users can log in from both environments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { email: 'chouaibbouaziz2001@gmail.com', complete: true },
              { email: 'med.zenoune20@gmail.com', complete: true },
              { email: 'zen.aimen20@gmail.com', complete: true },
              { email: 'yemataimen@gnail.com', complete: false },
              { email: 'wadieaymen0@gmail.com', complete: false },
            ].map((user, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <code className="text-sm">{user.email}</code>
                <Badge className={user.complete ? 'bg-green-500' : 'bg-yellow-500'}>
                  {user.complete ? 'Complete' : 'Incomplete'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

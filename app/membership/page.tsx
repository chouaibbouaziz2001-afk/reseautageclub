"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CreditCard,
  Check,
  Crown,
  Zap,
  Users,
  MessageSquare,
  Calendar,
  Star,
  TrendingUp,
  ArrowLeft
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface MembershipPlan {
  id: string;
  user_id: string;
  plan_type: string;
  card_last_four: string | null;
  card_brand: string | null;
  expires_at: string | null;
  created_at: string;
}

const plans = [
  {
    name: 'Free',
    value: 'free',
    price: '$0',
    period: 'forever',
    icon: Star,
    description: 'Perfect for getting started',
    features: [
      'Basic profile',
      'Join communities',
      'Connect with up to 50 people',
      'Create posts',
      'Basic messaging',
    ],
  },
  {
    name: 'Premium',
    value: 'premium',
    price: '$19',
    period: 'per month',
    icon: Crown,
    popular: true,
    description: 'For serious entrepreneurs',
    features: [
      'Everything in Free',
      'Unlimited connections',
      'Advanced profile customization',
      'Priority in co-founder matching',
      'Create and manage communities',
      'Analytics dashboard',
      'Premium badge',
    ],
  },
  {
    name: 'Enterprise',
    value: 'enterprise',
    price: '$99',
    period: 'per month',
    icon: TrendingUp,
    description: 'For growing teams',
    features: [
      'Everything in Premium',
      'Team management (up to 10 members)',
      'Advanced analytics',
      'Custom branding',
      'Priority support',
      'API access',
      'Dedicated account manager',
    ],
  },
];

export default function MembershipPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [membership, setMembership] = useState<MembershipPlan | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>('free');

  useEffect(() => {
    if (!user) {
      router.replace('/sign-in');
      return;
    }

    loadMembershipData();
  }, [user, router]);

  const loadMembershipData = async () => {
    if (!user) return;

    try {
      const { data: membershipData } = await supabase
        .from('membership_plans')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (membershipData) {
        setMembership(membershipData);
        setSelectedPlan(membershipData.plan_type);
      } else {
        await supabase.from('membership_plans').insert({
          user_id: user.id,
          plan_type: 'free',
        });
        setSelectedPlan('free');
      }
    } catch (error) {
      console.error('Error loading membership:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = (planValue: string) => {
    alert(`Upgrade to ${planValue} plan would be processed here. Payment integration required.`);
  };

  if (loading) {
    return (
      <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading membership...</p>
        </div>
      </div>
    );
  }

  const currentPlan = plans.find(p => p.value === selectedPlan);

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="hover:bg-gray-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-100 mb-2">Membership Plans</h1>
          <p className="text-gray-400 text-lg">Choose the plan that works best for you</p>
        </div>

        {membership && (
          <Card className="mb-8 border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Current Membership
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <Badge className="text-lg px-3 py-1 bg-amber-500">
                      {membership.plan_type.toUpperCase()}
                    </Badge>
                    {membership.plan_type === 'premium' && (
                      <Crown className="h-5 w-5 text-yellow-500" />
                    )}
                  </div>
                  <p className="text-gray-300">
                    {currentPlan?.price} {currentPlan?.period}
                  </p>
                  {membership.card_last_four && (
                    <p className="text-sm text-gray-400 mt-2">
                      Payment method: {membership.card_brand} ending in {membership.card_last_four}
                    </p>
                  )}
                  {membership.expires_at && (
                    <p className="text-sm text-gray-400">
                      Renews on: {new Date(membership.expires_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {membership.plan_type !== 'free' && (
                  <Button variant="outline" onClick={() => alert('Card management would be handled here')}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Update Payment Method
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isCurrentPlan = plan.value === selectedPlan;

            return (
              <Card
                key={plan.value}
                className={`relative ${
                  plan.popular ? 'border-blue-600 border-2 shadow-lg' : ''
                } ${isCurrentPlan ? 'ring-2 ring-green-500' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-amber-500 text-white px-3 py-1">
                      Most Popular
                    </Badge>
                  </div>
                )}

                {isCurrentPlan && (
                  <div className="absolute -top-4 right-4">
                    <Badge className="bg-green-600 text-white px-3 py-1">
                      Current Plan
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-4 p-3 bg-gray-100 rounded-full w-fit">
                    <Icon className="h-8 w-8 text-amber-500" />
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="mt-2">{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-gray-400 ml-2">/{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <Separator className="mb-4" />
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-300">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {isCurrentPlan ? (
                    <Button className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant={plan.popular ? 'default' : 'outline'}
                      onClick={() => handleUpgrade(plan.value)}
                    >
                      {plan.value === 'free' ? 'Downgrade' : 'Upgrade'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-gray-100 mb-2">Can I change my plan at any time?</h3>
              <p className="text-gray-300">
                Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately,
                and billing is prorated.
              </p>
            </div>
            <Separator />
            <div>
              <h3 className="font-semibold text-gray-100 mb-2">What payment methods do you accept?</h3>
              <p className="text-gray-300">
                We accept all major credit cards including Visa, Mastercard, American Express, and Discover.
              </p>
            </div>
            <Separator />
            <div>
              <h3 className="font-semibold text-gray-100 mb-2">Is there a refund policy?</h3>
              <p className="text-gray-300">
                Yes, we offer a 30-day money-back guarantee for all paid plans. If you're not satisfied,
                contact us for a full refund.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

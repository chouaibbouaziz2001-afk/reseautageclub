"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Lightbulb, Rocket, ArrowRight } from 'lucide-react';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/feed');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900">

      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-100 leading-tight">
                Connect with Entrepreneurs.{' '}
                <span className="bg-gradient-to-r from-amber-500 to-yellow-500 bg-clip-text text-transparent">
                  Share Ideas.
                </span>{' '}
                Build Together.
              </h1>
              <p className="text-xl text-gray-300 leading-relaxed">
                Join a community of founders, innovators, and dreamers building the future.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/sign-up">
                  <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-gray-900 font-semibold shadow-lg hover:shadow-xl transition-all">
                    Get Started
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-2 border-amber-500 text-amber-400 hover:bg-amber-500 hover:text-gray-900 transition-all">
                  Learn More
                </Button>
              </div>
            </div>
            <div className="relative h-96 lg:h-[500px] rounded-2xl overflow-hidden shadow-2xl">
              <Image
                src="https://images.pexels.com/photos/3183197/pexels-photo-3183197.jpeg?auto=compress&cs=tinysrgb&w=1200"
                alt="Team collaboration"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-r from-gray-950 via-stone-950 to-gray-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative order-2 lg:order-1">
              <div className="relative w-full max-w-md mx-auto">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-2xl blur-2xl opacity-20"></div>
                <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-amber-500/30 h-[600px]">
                  <Image
                    src="/patrice.jpg"
                    alt="Patrice Cazelais"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6 order-1 lg:order-2">
              <div className="space-y-2">
                <h3 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">
                  PATRICE CAZELAIS
                </h3>
                <p className="text-xl text-amber-500 font-semibold tracking-wide">
                  FOUNDER
                </p>
              </div>

              <div className="space-y-4 text-gray-300 leading-relaxed text-lg">
                <p>
                  Driven by conviction and passion, creating this networking company was an obvious choice for me. The goal? To share my expertise and help entrepreneurs and self-employed workers achieve their dreams and reach their full potential.
                </p>
                <p>
                  Training is the key to success, and I have developed a unique way to pass on knowledge to our members with the help of experts from various fields. The project has been growing across several regions of Quebec and internationally since 2018.
                </p>
                <p>
                  Today, the community of entrepreneurs includes more than 2,500 members striving to reach their full potential.
                </p>
              </div>

              <div className="pt-4">
                <div className="inline-flex items-center space-x-2 text-amber-400">
                  <div className="w-12 h-0.5 bg-gradient-to-r from-amber-500 to-yellow-500"></div>
                  <span className="text-sm font-semibold tracking-wider">SINCE 2018</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-gray-100">
                  2,500+ <span className="text-amber-400">Members</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-b from-gray-900 to-stone-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-100 mb-4">
              Why Join Our Community?
            </h2>
            <p className="text-xl text-gray-400">
              Everything you need to connect and grow
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="group hover:shadow-2xl transition-all duration-300 border-2 border-gray-800 hover:border-amber-500 bg-gray-900/50">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-gray-800 rounded-full flex items-center justify-center group-hover:bg-gradient-to-br group-hover:from-amber-500 group-hover:to-yellow-500 transition-all duration-300">
                  <Users className="h-8 w-8 text-amber-500 group-hover:text-gray-900 transition-colors duration-300" />
                </div>
                <h3 className="text-2xl font-bold text-gray-100">Network</h3>
                <p className="text-gray-400">
                  Connect with like-minded founders and expand your professional circle
                </p>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-2xl transition-all duration-300 border-2 border-gray-800 hover:border-amber-500 bg-gray-900/50">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-gray-800 rounded-full flex items-center justify-center group-hover:bg-gradient-to-br group-hover:from-amber-500 group-hover:to-yellow-500 transition-all duration-300">
                  <Lightbulb className="h-8 w-8 text-amber-500 group-hover:text-gray-900 transition-colors duration-300" />
                </div>
                <h3 className="text-2xl font-bold text-gray-100">Collaborate</h3>
                <p className="text-gray-400">
                  Exchange ideas and get valuable feedback on your projects
                </p>
              </CardContent>
            </Card>

            <Card className="group hover:shadow-2xl transition-all duration-300 border-2 border-gray-800 hover:border-amber-500 bg-gray-900/50">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-gray-800 rounded-full flex items-center justify-center group-hover:bg-gradient-to-br group-hover:from-amber-500 group-hover:to-yellow-500 transition-all duration-300">
                  <Rocket className="h-8 w-8 text-amber-500 group-hover:text-gray-900 transition-colors duration-300" />
                </div>
                <h3 className="text-2xl font-bold text-gray-100">Grow</h3>
                <p className="text-gray-400">
                  Find co-founders, investors, and scale your business together
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-stone-950 to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-100 mb-4">
              Get Started in 3 Simple Steps
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-amber-500 to-yellow-500 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-gray-900 text-2xl font-bold">1</span>
              </div>
              <h3 className="text-xl font-bold text-gray-100">Create Your Profile</h3>
              <p className="text-gray-400">
                Share your story, skills, and what you're working on
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-amber-500 to-yellow-500 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-gray-900 text-2xl font-bold">2</span>
              </div>
              <h3 className="text-xl font-bold text-gray-100">Connect & Share</h3>
              <p className="text-gray-400">
                Build your network and engage with the community
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-amber-500 to-yellow-500 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-gray-900 text-2xl font-bold">3</span>
              </div>
              <h3 className="text-xl font-bold text-gray-100">Grow Together</h3>
              <p className="text-gray-400">
                Collaborate on projects and achieve your goals
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-r from-gray-950 to-stone-950">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-500 mb-6">
            Ready to start your entrepreneurial journey?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join thousands of entrepreneurs building the future together
          </p>
          <Link href="/sign-up">
            <Button size="lg" className="bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-900 hover:from-amber-600 hover:to-yellow-600 font-semibold shadow-xl hover:shadow-2xl transition-all">
              Join Now
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="bg-gray-950 text-white py-12 border-t-4 border-amber-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-amber-600 to-yellow-600 rounded-lg flex items-center justify-center">
                  <span className="text-gray-900 font-bold text-xl">R</span>
                </div>
                <span className="text-xl font-bold text-amber-400">ReseautageClub</span>
              </div>
              <p className="text-gray-400">
                Building the future together
              </p>
            </div>
            <div>
              <h3 className="font-bold mb-4 text-amber-400">Company</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="#" className="hover:text-amber-400 transition-colors">About</Link></li>
                <li><Link href="#" className="hover:text-amber-400 transition-colors">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4 text-amber-400">Legal</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="#" className="hover:text-amber-400 transition-colors">Privacy</Link></li>
                <li><Link href="#" className="hover:text-amber-400 transition-colors">Terms</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-4 text-amber-400">Connect</h3>
              <div className="flex space-x-4 text-gray-400">
                <span className="hover:text-amber-400 transition-colors cursor-pointer">Twitter</span>
                <span className="hover:text-amber-400 transition-colors cursor-pointer">LinkedIn</span>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-gray-400">
            <p>&copy; 2025 ReseautageClub. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

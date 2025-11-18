import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function FeedSkeleton() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-6 md:py-8">
        <div className="grid lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
          <div className="lg:col-span-2 space-y-3 sm:space-y-4 md:space-y-6">
            <Card className="bg-gray-900/50 border-gray-800 animate-pulse">
              <CardContent className="p-4 sm:p-6">
                <div className="h-6 bg-gray-800 rounded w-1/3 mb-2" />
                <div className="h-4 bg-gray-800 rounded w-1/2" />
              </CardContent>
            </Card>

            <div className="grid sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="bg-gray-900/50 border-gray-800 animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-12 w-12 bg-gray-800 rounded-full mx-auto mb-3" />
                    <div className="h-8 bg-gray-800 rounded w-16 mx-auto mb-2" />
                    <div className="h-4 bg-gray-800 rounded w-20 mx-auto" />
                  </CardContent>
                </Card>
              ))}
            </div>

            {[1, 2].map((i) => (
              <Card key={i} className="bg-gray-900/50 border-gray-800 animate-pulse">
                <CardContent className="p-4">
                  <div className="flex gap-3 mb-3">
                    <div className="h-12 w-12 bg-gray-800 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-800 rounded w-1/4" />
                      <div className="h-3 bg-gray-800 rounded w-1/6" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-800 rounded w-full" />
                    <div className="h-4 bg-gray-800 rounded w-5/6" />
                    <div className="h-4 bg-gray-800 rounded w-4/6" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-6">
            <Card className="bg-gray-900/50 border-gray-800 animate-pulse">
              <CardHeader>
                <div className="h-5 bg-gray-800 rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="h-4 bg-gray-800 rounded w-3/4" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NetworkSkeleton() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-6 md:py-8">
        <div className="mb-4 sm:mb-6 md:mb-8">
          <div className="h-8 bg-gray-800 rounded w-32 mb-2 animate-pulse" />
          <div className="h-4 bg-gray-800 rounded w-64 animate-pulse" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="bg-gray-900/50 border-gray-800 animate-pulse">
              <CardContent className="p-4 sm:p-5 md:p-6">
                <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
                  <div className="h-16 w-16 bg-gray-800 rounded-full" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 bg-gray-800 rounded w-1/2" />
                    <div className="h-3 bg-gray-800 rounded w-full" />
                    <div className="h-3 bg-gray-800 rounded w-3/4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MessagesSkeleton() {
  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-2 sm:py-4 md:py-8">
        <Card className="h-[calc(100vh-6rem)] sm:h-[calc(100vh-10rem)] md:h-[calc(100vh-12rem)] bg-gray-950 border-gray-800 animate-pulse">
          <div className="flex h-full">
            <div className="w-full md:w-96 border-r border-gray-800 flex flex-col">
              <div className="p-3 sm:p-5 border-b border-gray-800 bg-gray-900/50">
                <div className="h-6 bg-gray-800 rounded w-32" />
              </div>
              <div className="flex-1 p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3 p-3">
                    <div className="h-12 w-12 bg-gray-800 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-800 rounded w-3/4" />
                      <div className="h-3 bg-gray-800 rounded w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden md:flex flex-1 items-center justify-center">
              <div className="text-center">
                <div className="h-16 w-16 bg-gray-800 rounded-full mx-auto mb-4" />
                <div className="h-5 bg-gray-800 rounded w-48 mx-auto mb-2" />
                <div className="h-4 bg-gray-800 rounded w-64 mx-auto" />
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export function CommunitiesSkeleton() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-6 md:py-8">
        <div className="mb-4 sm:mb-6 md:mb-8">
          <div className="h-8 bg-gray-800 rounded w-32 mb-2 animate-pulse" />
          <div className="h-4 bg-gray-800 rounded w-64 animate-pulse" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="bg-gray-900/50 border-gray-800 animate-pulse">
              <div className="h-40 bg-gray-800" />
              <CardContent className="p-4">
                <div className="h-6 bg-gray-800 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-800 rounded w-full mb-3" />
                <div className="h-3 bg-gray-800 rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-6 md:py-8">
        <Card className="bg-gray-900/50 border-gray-800 animate-pulse">
          <div className="relative h-48 bg-gray-800" />
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="h-24 w-24 bg-gray-800 rounded-full -mt-12" />
              <div className="flex-1 pt-4 space-y-3">
                <div className="h-6 bg-gray-800 rounded w-1/3" />
                <div className="h-4 bg-gray-800 rounded w-1/2" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-800 rounded w-full" />
              <div className="h-4 bg-gray-800 rounded w-5/6" />
              <div className="h-4 bg-gray-800 rounded w-4/6" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function GenericSkeleton() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-6 md:py-8">
        <div className="space-y-4">
          <div className="h-8 bg-gray-800 rounded w-48 mb-6 animate-pulse" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="bg-gray-900/50 border-gray-800 animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-5 bg-gray-800 rounded w-1/2" />
                  <div className="h-4 bg-gray-800 rounded w-full" />
                  <div className="h-4 bg-gray-800 rounded w-4/5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Navigation */}
      <nav className="navbar">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold gradient-text">
                  Kyarafit
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/auth/signin" className="btn-secondary">
                Sign In
              </Link>
              <Link href="/auth/signup" className="btn-primary">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative overflow-hidden">
        {/* Background with Sakura gradient */}
        <div className="gradient-primary h-96 flex items-center justify-center sakura-bloom relative overflow-hidden">
          {/* Floating Sakura petals */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-10 left-10 w-4 h-4 bg-sakura-pink rounded-full animate-bounce" style={{animationDelay: '0s', animationDuration: '3s'}}></div>
            <div className="absolute top-20 right-20 w-3 h-3 bg-sakura-soft-pink rounded-full animate-bounce" style={{animationDelay: '1s', animationDuration: '4s'}}></div>
            <div className="absolute bottom-20 left-1/4 w-2 h-2 bg-sakura-petal rounded-full animate-bounce" style={{animationDelay: '2s', animationDuration: '5s'}}></div>
            <div className="absolute bottom-10 right-1/3 w-3 h-3 bg-sakura-pink rounded-full animate-bounce" style={{animationDelay: '0.5s', animationDuration: '3.5s'}}></div>
            <div className="absolute top-1/3 right-10 w-2 h-2 bg-sakura-soft-pink rounded-full animate-bounce" style={{animationDelay: '1.5s', animationDuration: '4.5s'}}></div>
          </div>
          
          <div className="text-center text-white px-4 relative z-10">
            <h1 className="text-6xl font-bold mb-6 animate-pulse-roblox">
              Kyarafit
            </h1>
            <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
              The ultimate cosplay wardrobe and outfit planning app. 
              Organize, track, and design your perfect character coords.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/signup" className="btn-primary bg-white text-sakura-deep-pink hover:bg-sakura-petal">
                Start Building
              </Link>
              <Link href="/auth/signin" className="btn-secondary bg-transparent border-white text-white hover:bg-white hover:text-sakura-deep-pink">
                Sign In
              </Link>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="py-20 bg-bg-primary">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-text-primary mb-4">
                Everything you need for cosplay
              </h2>
              <p className="text-xl text-text-secondary max-w-3xl mx-auto">
                From wardrobe organization to convention planning, Kyarafit has all the tools you need to bring your characters to life.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Feature Cards */}
              <div className="card group hover:scale-105 transition-transform duration-300 sakura-petal">
                <div className="w-16 h-16 bg-gradient-to-br from-sakura-pink to-sakura-deep-pink rounded-xl flex items-center justify-center mb-6 group-hover:animate-bounce-roblox">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-text-primary mb-4">Closet Management</h3>
                <p className="text-text-secondary">Upload and organize your costume pieces, wigs, and props with AI-powered cutouts and smart categorization.</p>
              </div>

              <div className="card group hover:scale-105 transition-transform duration-300 sakura-petal">
                <div className="w-16 h-16 bg-gradient-to-br from-sakura-mint to-sakura-lavender rounded-xl flex items-center justify-center mb-6 group-hover:animate-bounce-roblox">
                  <svg className="w-8 h-8 text-sakura-deep-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-text-primary mb-4">Build Tracking</h3>
                <p className="text-text-secondary">Track your cosplay builds from idea to completion with progress milestones, budget tracking, and deadline management.</p>
              </div>

              <div className="card group hover:scale-105 transition-transform duration-300 sakura-petal">
                <div className="w-16 h-16 bg-gradient-to-br from-sakura-blossom to-sakura-pink rounded-xl flex items-center justify-center mb-6 group-hover:animate-bounce-roblox">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-text-primary mb-4">Coord Builder</h3>
                <p className="text-text-secondary">Design perfect character outfits with our drag-and-drop layered canvas and real-time preview system.</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="py-20 bg-bg-secondary">
          <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
            <h2 className="text-4xl font-bold text-text-primary mb-6">
              Ready to start your cosplay journey?
            </h2>
            <p className="text-xl text-text-secondary mb-8">
              Join thousands of cosplayers who are already using Kyarafit to organize their wardrobes and plan their next builds.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/signup" className="btn-primary text-lg px-8 py-4">
                Create Your Account
              </Link>
              <Link href="/auth/signin" className="btn-secondary text-lg px-8 py-4">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

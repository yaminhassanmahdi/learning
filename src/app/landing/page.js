'use client'
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Vortex } from '@/components/ui/vortex';
import { BackgroundBeams } from '@/components/ui/background-beams';
import { AuroraText } from '@/components/magicui/aurora-text';
import { BorderBeam } from '@/components/magicui/border-beam';
import { 
  Brain, 
  BookOpen, 
  FileText, 
  MessageCircle, 
  Calendar,
  TrendingUp,
  Sparkles,
  ArrowRight,
  CheckCircle
} from 'lucide-react';

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If user is already logged in, redirect to dashboard
    if (user && !loading) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleGetStarted = () => {
    router.push('/login');
  };

  const features = [
    {
      icon: <Brain className="w-6 h-6" />,
      title: "AI-Powered Learning",
      description: "Generate quizzes, summaries, and flashcards from your study materials"
    },
    {
      icon: <FileText className="w-6 h-6" />,
      title: "Document Processing",
      description: "Upload PDFs and get instant insights and study aids"
    },
    {
      icon: <MessageCircle className="w-6 h-6" />,
      title: "Smart Chat",
      description: "Ask questions and get intelligent responses from your documents"
    },
    {
      icon: <Calendar className="w-6 h-6" />,
      title: "Study Planning",
      description: "Organize your study schedule and track your progress"
    },
    {
      icon: <TrendingUp className="w-6 h-6" />,
      title: "Progress Tracking",
      description: "Monitor your learning progress with detailed analytics"
    },
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: "Personalized Experience",
      description: "Adaptive learning that grows with your study habits"
    }
  ];

  const benefits = [
    "Save hours of study time with AI-generated content",
    "Improve retention with personalized learning paths",
    "Access your study materials anywhere, anytime",
    "Track your progress with detailed analytics",
    "Collaborate with other learners",
    "Get instant feedback on your performance"
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (user) {
    return null; // Will redirect to dashboard
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 overflow-hidden">
      <BackgroundBeams />
      
      {/* Header */}
      <header className="relative z-10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Brain className="w-8 h-8 text-blue-600" />
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Learningly
            </span>
          </div>
          <div className="flex space-x-4">
            <Button 
              variant="ghost" 
              onClick={handleGetStarted}
              className="text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Sign In
            </Button>
            <Button 
              onClick={handleGetStarted}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 px-6 py-20">
        <div className="max-w-7xl mx-auto text-center">
          <AuroraText className="text-6xl md:text-8xl font-bold bg-gradient-to-r from-zinc-900 to-zinc-600 dark:from-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent mb-6">
            Transform Your Learning
          </AuroraText>
          <p className="text-xl md:text-2xl text-zinc-600 dark:text-zinc-400 mb-8 max-w-3xl mx-auto">
            AI-powered study platform that helps you learn smarter, not harder. 
            Upload your documents and get instant quizzes, summaries, and personalized insights.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg"
              onClick={handleGetStarted}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg"
            >
              Start Learning Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="px-8 py-4 text-lg"
            >
              Watch Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 px-6 py-20 bg-white dark:bg-zinc-800">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-xl text-zinc-600 dark:text-zinc-400">
              Powerful tools designed to enhance your learning experience
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <BorderBeam key={index} className="p-6 rounded-xl bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                    {feature.title}
                  </h3>
                </div>
                <p className="text-zinc-600 dark:text-zinc-400">
                  {feature.description}
                </p>
              </BorderBeam>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="relative z-10 px-6 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Why Choose Learningly?
            </h2>
            <p className="text-xl text-zinc-600 dark:text-zinc-400">
              Join thousands of students who are already learning smarter
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center space-x-3">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                <span className="text-lg text-zinc-700 dark:text-zinc-300">
                  {benefit}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 px-6 py-20 bg-blue-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Learning?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of students who are already learning smarter with AI
          </p>
          <Button 
            size="lg"
            onClick={handleGetStarted}
            className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-4 text-lg"
          >
            Get Started Now
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-12 bg-zinc-900 text-zinc-400">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Brain className="w-6 h-6 text-blue-600" />
            <span className="text-xl font-bold text-zinc-100">
              Learningly
            </span>
          </div>
          <p className="text-sm">
            © 2024 Learningly. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
} 
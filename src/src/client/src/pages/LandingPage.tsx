import React from 'react';
import { Link } from 'react-router-dom';
import { Github, Zap, Shield, BarChart3, CheckCircle } from 'lucide-react';
import Button from '../components/ui/Button';

const LandingPage: React.FC = () => {
  const features = [
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'AI-Powered Analysis',
      description: 'Advanced AI algorithms analyze your code for quality, security, and performance issues.'
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: 'Security Scanning',
      description: 'Detect vulnerabilities and security issues before they reach production.'
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: 'Detailed Reports',
      description: 'Get comprehensive reports with actionable insights and recommendations.'
    },
    {
      icon: <Github className="w-6 h-6" />,
      title: 'GitHub Integration',
      description: 'Seamlessly integrate with your GitHub repositories and workflows.'
    }
  ];

  const pricing = [
    {
      name: 'Free',
      price: '$0',
      description: 'Perfect for individual developers',
      features: [
        'Up to 3 repositories',
        '10 analyses per month',
        'Basic code quality metrics',
        'Email support'
      ]
    },
    {
      name: 'Starter',
      price: '$29',
      description: 'Great for small teams',
      features: [
        'Up to 10 repositories',
        '50 analyses per month',
        'Advanced AI insights',
        'Security scanning',
        'Priority support'
      ],
      popular: true
    },
    {
      name: 'Professional',
      price: '$99',
      description: 'For growing teams',
      features: [
        'Unlimited repositories',
        '500 analyses per month',
        'Team collaboration',
        'Custom rules',
        'Advanced reporting',
        'Priority support'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="flex items-center space-x-2">
                <Zap className="w-8 h-8 text-primary-600" />
                <span className="text-2xl font-bold text-gray-900">Vibecode</span>
              </div>
            </div>
            <nav className="hidden md:flex space-x-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900">Features</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900">Pricing</a>
              <Link to="/login" className="text-gray-600 hover:text-gray-900">Login</Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-6">
            AI-Powered Code Analysis
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Transform your development workflow with intelligent code analysis. 
            Get instant insights, security recommendations, and quality improvements.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="px-8" asChild>
              <Link to="/login">
                <Github className="w-5 h-5 mr-2" />
                Get Started with GitHub
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="px-8">
              View Demo
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            Free forever for public repositories
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Powerful Features for Modern Development
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Our AI-powered platform provides comprehensive code analysis 
              to help you build better, more secure applications.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-primary-100 text-primary-600 rounded-lg">
                    {feature.icon}
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-gray-600">
              Choose the plan that fits your needs. Upgrade or downgrade anytime.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricing.map((plan, index) => (
              <div
                key={index}
                className={`relative rounded-lg border p-8 ${
                  plan.popular
                    ? 'border-primary-600 ring-2 ring-primary-600'
                    : 'border-gray-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-primary-600 text-white px-3 py-1 text-sm font-medium rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {plan.name}
                  </h3>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {plan.price}
                    {plan.price !== '$0' && <span className="text-lg text-gray-600">/month</span>}
                  </div>
                  <p className="text-gray-600">{plan.description}</p>
                </div>
                
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-3" />
                      <span className="text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button
                  variant={plan.popular ? 'primary' : 'outline'}
                  className="w-full"
                  asChild
                >
                  <Link to="/login">
                    Get Started
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to improve your code quality?
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Join thousands of developers who trust Vibecode for their code analysis needs.
          </p>
          <Button variant="secondary" size="lg" className="px-8" asChild>
            <Link to="/login">
              <Github className="w-5 h-5 mr-2" />
              Start analyzing for free
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Zap className="w-6 h-6 text-primary-500" />
              <span className="text-lg font-semibold text-white">Vibecode</span>
            </div>
            <div className="flex space-x-6">
              <a href="#" className="hover:text-white">Terms</a>
              <a href="#" className="hover:text-white">Privacy</a>
              <a href="#" className="hover:text-white">Support</a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center">
            <p>&copy; 2024 Vibecode. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
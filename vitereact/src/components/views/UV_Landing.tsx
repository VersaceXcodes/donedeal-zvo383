import React, { useEffect, useState } from "react";
import { Navigate, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useAppStore } from "@/store/main";

interface Category {
  uid: string;
  name: string;
  image_url: string;
}

interface Testimonial {
  photo_url: string;
  name: string;
  quote: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const UV_Landing: React.FC = () => {
  // global state
  const isAuthenticated = useAppStore(state => state.auth?.is_authenticated ?? false);
  const maintenanceMode = useAppStore(state => state.site_settings?.maintenance_mode?.enabled ?? false);

  const navigate = useNavigate();

  // Fetch featured categories
  const {
    data: featuredCategories,
    isLoading: isLoadingCategories,
    isError: isErrorCategories,
    error: categoriesError
  } = useQuery<Category[], Error>({
    queryKey: ["featuredCategories"],
    queryFn: async () => {
      const { data } = await axios.get<Category[]>(
        `${API_BASE_URL}/api/categories?featured=true`
      );
      return data;
    }
  });

  // Fetch testimonials
  const {
    data: testimonials,
    isLoading: isLoadingTestimonials,
    isError: isErrorTestimonials,
    error: testimonialsError
  } = useQuery<Testimonial[], Error>({
    queryKey: ["testimonials"],
    queryFn: async () => {
      const { data } = await axios.get<Testimonial[]>(
        `${API_BASE_URL}/api/testimonials`
      );
      return data;
    }
  });

  // Carousel state
  const [currentTestimonialIndex, setCurrentTestimonialIndex] = useState(0);

  useEffect(() => {
    if (!testimonials || testimonials.length === 0) return;
    const interval = setInterval(() => {
      setCurrentTestimonialIndex(prev =>
        (prev + 1) % testimonials.length
      );
    }, 5000);
    return () => clearInterval(interval);
  }, [testimonials]);

  // Newsletter state & mutation
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterError, setNewsletterError] = useState<string | null>(null);
  const [newsletterSuccess, setNewsletterSuccess] = useState(false);

  const newsletterMutation = useMutation<unknown, Error, { email: string }>({
    mutationFn: async ({ email }) => {
      const { data } = await axios.post(
        `${API_BASE_URL}/api/newsletter`,
        { email }
      );
      return data;
    },
    onSuccess: () => {
      setNewsletterSuccess(true);
      setNewsletterError(null);
    },
    onError: err => {
      setNewsletterError(err.message);
      setNewsletterSuccess(false);
    }
  });

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNewsletterError(null);
    setNewsletterSuccess(false);
    newsletterMutation.mutate({ email: newsletterEmail });
  };

  const handleSignUp = () => navigate("/signup");
  const handleLogin = () => navigate("/login");

  // redirect signed-in users
  if (isAuthenticated) {
    return <Navigate to="/home" replace />;
  }

  return (
    <>
      {/* Maintenance Banner */}
      {maintenanceMode && (
        <div className="bg-yellow-200 text-yellow-800 p-4 text-center">
          The site is currently under maintenance. Some features may be unavailable.
        </div>
      )}

      {/* Hero Banner */}
      <section className="bg-gray-50 py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold">Buy. Sell. Trade. Locally.</h1>
          <p className="mt-4 text-lg text-gray-600">
            MarketMate brings the best deals in your neighborhood directly to you.
          </p>
          <div className="mt-8 flex justify-center space-x-4">
            <button
              onClick={handleSignUp}
              className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Sign Up
            </button>
            <button
              onClick={handleLogin}
              className="px-6 py-3 bg-white text-blue-600 border border-blue-600 rounded hover:bg-blue-100"
            >
              Login
            </button>
          </div>
        </div>
      </section>

      {/* Featured Categories */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-semibold mb-6 text-center">
            Featured Categories
          </h2>
          {isLoadingCategories ? (
            <p className="text-center">Loading categories...</p>
          ) : isErrorCategories ? (
            <p className="text-center text-red-500">
              Error loading categories: {categoriesError?.message}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {featuredCategories?.map(cat => (
                <Link
                  to={`/categories/${cat.uid}`}
                  key={cat.uid}
                  className="group block border rounded-lg overflow-hidden hover:shadow-lg"
                >
                  <img
                    src={cat.image_url}
                    alt={cat.name}
                    className="w-full h-32 object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="p-4 text-center">
                    <h3 className="text-lg font-medium">{cat.name}</h3>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-semibold mb-10">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center">
              <img
                src="https://picsum.photos/seed/step1/100/100"
                alt="Create Listing"
                className="mb-4"
              />
              <h3 className="text-xl font-medium">Create a Listing</h3>
              <p className="mt-2 text-gray-600">
                Upload photos and details of your item in minutes.
              </p>
            </div>
            <div className="flex flex-col items-center">
              <img
                src="https://picsum.photos/seed/step2/100/100"
                alt="Search Items"
                className="mb-4"
              />
              <h3 className="text-xl font-medium">Search Items</h3>
              <p className="mt-2 text-gray-600">
                Find what you’re looking for using filters and keywords.
              </p>
            </div>
            <div className="flex flex-col items-center">
              <img
                src="https://picsum.photos/seed/step3/100/100"
                alt="Message Seller"
                className="mb-4"
              />
              <h3 className="text-xl font-medium">Message Seller</h3>
              <p className="mt-2 text-gray-600">
                Negotiate and finalize deals securely through our platform.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Carousel */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-semibold mb-10">
            What Our Users Say
          </h2>
          {isLoadingTestimonials ? (
            <p className="text-center">Loading testimonials...</p>
          ) : isErrorTestimonials ? (
            <p className="text-center text-red-500">
              Error loading testimonials: {testimonialsError?.message}
            </p>
          ) : testimonials && testimonials.length > 0 ? (
            <div className="relative max-w-xl mx-auto">
              <div className="p-6 border rounded-lg">
                <img
                  src={testimonials[currentTestimonialIndex].photo_url}
                  alt={testimonials[currentTestimonialIndex].name}
                  className="w-16 h-16 rounded-full mx-auto"
                />
                <p className="mt-4 italic">
                  &quot;{testimonials[currentTestimonialIndex].quote}&quot;
                </p>
                <p className="mt-2 font-semibold">
                  {testimonials[currentTestimonialIndex].name}
                </p>
              </div>
              <button
                onClick={() =>
                  setCurrentTestimonialIndex(i =>
                    (i - 1 + testimonials.length) % testimonials.length
                  )
                }
                aria-label="Previous Testimonial"
                className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-gray-200 hover:bg-gray-300 p-2 rounded-full"
              >
                &#8592;
              </button>
              <button
                onClick={() =>
                  setCurrentTestimonialIndex(i =>
                    (i + 1) % testimonials.length
                  )
                }
                aria-label="Next Testimonial"
                className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-gray-200 hover:bg-gray-300 p-2 rounded-full"
              >
                &#8594;
              </button>
            </div>
          ) : (
            <p className="text-center">No testimonials available.</p>
          )}
        </div>
      </section>

      {/* Newsletter Signup */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 text-center max-w-md">
          <h2 className="text-3xl font-semibold mb-4">Stay Updated</h2>
          <p className="text-gray-600 mb-6">
            Subscribe to our newsletter for the latest updates.
          </p>
          {newsletterSuccess ? (
            <p className="text-green-600">Thank you for subscribing!</p>
          ) : (
            <form
              onSubmit={handleNewsletterSubmit}
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                type="email"
                required
                value={newsletterEmail}
                onChange={e => setNewsletterEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={newsletterMutation.isLoading}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {newsletterMutation.isLoading
                  ? "Subscribing..."
                  : "Subscribe"}
              </button>
            </form>
          )}
          {newsletterError && (
            <p className="mt-2 text-red-500">{newsletterError}</p>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-200 py-8">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0 text-center md:text-left">
            <h3 className="text-lg font-semibold">MarketMate</h3>
            <p className="text-sm">
              © {new Date().getFullYear()} MarketMate. All rights reserved.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link to="/terms" className="hover:underline">
              Terms &amp; Conditions
            </Link>
            <Link to="/privacy" className="hover:underline">
              Privacy Policy
            </Link>
            <Link to="/help" className="hover:underline">
              Help
            </Link>
            <Link to="/contact" className="hover:underline">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
};

export default UV_Landing;
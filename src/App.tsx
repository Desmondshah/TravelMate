import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { TravelPlanner } from "./TravelPlanner";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md h-16 flex justify-between items-center border-b shadow-sm px-6">
        <h2 className="text-2xl font-bold text-primary">TravelMate AI</h2>
        <SignOutButton />
      </header>
      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-5xl mx-auto">
          <Content />
        </div>
      </main>
      <Toaster richColors position="top-right" />
    </div>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <Authenticated>
        <TravelPlanner />
      </Authenticated>
      <Unauthenticated>
        <div className="bg-white p-8 rounded-lg shadow-xl text-center max-w-lg mx-auto">
          <h1 className="text-4xl font-extrabold text-primary mb-4">
            Welcome to TravelMate AI!
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Get personalized travel plans powered by AI. Sign in to start planning your international journey.
          </p>
          <SignInForm />
        </div>
      </Unauthenticated>
    </div>
  );
}

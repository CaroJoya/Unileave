import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
      <div className="text-center space-y-6 max-w-2xl px-4">
        <h1 className="text-5xl font-bold text-gray-900">UniLeave</h1>
        <p className="text-xl text-gray-600">University Leave Management System</p>
        <div className="flex gap-4 justify-center pt-4">
          <Link href="/login">
            <Button size="lg">Get Started</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
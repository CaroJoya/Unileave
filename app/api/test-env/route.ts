// app/api/test-env/route.ts - FIXED
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    projectId: !!process.env.FIREBASE_PROJECT_ID,
    clientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: !!process.env.FIREBASE_PRIVATE_KEY,
    databaseURL: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
}
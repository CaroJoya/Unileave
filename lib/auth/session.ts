import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";

export async function createSession(idToken: string) {
  const expiresIn = 60 * 60 * 24 * 30 * 1000; // 30 days (no expiry)
  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn,
  });
  
  (await cookies()).set("unileave-session", sessionCookie, {
    maxAge: expiresIn / 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function destroySession() {
  (await cookies()).delete("unileave-session");
}

export async function getSession() {
  const cookieStore = await cookies();
  return cookieStore.get("unileave-session")?.value;
}
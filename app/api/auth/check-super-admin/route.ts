import { NextResponse } from "next/server";
import { rtdb } from "@/lib/firebase/admin";
import { Database } from 'firebase-admin/database';

export async function GET() {
  try {
    // If rtdb is not initialized (missing env vars), return false
    if (!rtdb) {
      console.warn("Firebase Admin not initialized - returning false for super admin check");
      return NextResponse.json({ hasSuperAdmin: false });
    }

    console.log("Checking for super admin...");
    
    const snapshot = await (rtdb as Database).ref('users').once('value');
    
    let hasSuperAdmin = false;
    
    if (snapshot.exists()) {
      const users = snapshot.val();
      if (users && typeof users === 'object') {
        for (const userId in users) {
          const user = users[userId];
          if (user && user.roles && Array.isArray(user.roles) && user.roles.includes('super_admin')) {
            hasSuperAdmin = true;
            break;
          }
        }
      }
    }
    
    console.log("Has super admin:", hasSuperAdmin);

    return NextResponse.json({ hasSuperAdmin });
  } catch (error) {
    console.error("Error checking super admin:", error);
    return NextResponse.json({ hasSuperAdmin: false });
  }
}
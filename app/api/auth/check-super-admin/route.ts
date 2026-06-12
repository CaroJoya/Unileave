import { NextResponse } from "next/server";
import { rtdb } from "@/lib/firebase/admin";

export async function GET() {
  try {
    if (!rtdb) {
      console.warn("Firebase Admin not initialized");
      return NextResponse.json({ hasSuperAdmin: false });
    }

    console.log("Checking for any super admin...");
    
    const snapshot = await rtdb.ref('users').once('value');
    
    let hasSuperAdmin = false;
    let collegeCount = 0;
    
    if (snapshot.exists()) {
      const users = snapshot.val();
      if (users && typeof users === 'object') {
        for (const userId in users) {
          const user = users[userId];
          if (user && user.roles && Array.isArray(user.roles) && user.roles.includes('super_admin')) {
            hasSuperAdmin = true;
            collegeCount++;
          }
        }
      }
    }
    
    console.log(`Found ${collegeCount} college(s) with super admin`);
    
    // Return true if ANY super admin exists (any college)
    return NextResponse.json({ 
      hasSuperAdmin,
      collegeCount 
    });
  } catch (error) {
    console.error("Error checking super admin:", error);
    return NextResponse.json({ hasSuperAdmin: false });
  }
}
import { NextResponse } from "next/server";
//import { rtdb } from "@/lib/firebase/admin";

import { getRTDB } from "@/lib/firebase/admin";
const rtdb = getRTDB();
//const auth = getAuth();
export async function GET() {
  try {
    if (!rtdb) {
      console.warn("Firebase Admin not initialized");
      return NextResponse.json({ hasSuperAdmin: false });
    }

    console.log("Checking for any college (super admin indicator)...");
    
    // ✅ OPTIMIZED: Check if any college exists instead of scanning all users
    // A college is created when the first super admin registers
    const snapshot = await rtdb.ref('colleges').limitToFirst(1).once('value');
    
    let hasSuperAdmin = false;
    let collegeCount = 0;
    
    if (snapshot.exists()) {
      const colleges = snapshot.val();
      if (colleges && typeof colleges === 'object') {
        // Count how many colleges exist
        collegeCount = Object.keys(colleges).length;
        hasSuperAdmin = collegeCount > 0;
      }
    }
    
    console.log(`Found ${collegeCount} college(s) - Super admin exists: ${hasSuperAdmin}`);
    
    return NextResponse.json({ 
      hasSuperAdmin,
      collegeCount 
    });
  } catch (error) {
    console.error("Error checking super admin:", error);
    return NextResponse.json({ hasSuperAdmin: false });
  }
}
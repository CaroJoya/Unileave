// app/api/auth/check-super-admin/route.ts
import { NextResponse } from "next/server";
import { getRTDB } from "@/lib/firebase/admin";

const rtdb = getRTDB();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const collegeName = searchParams.get("collegeName") || "";
    
    if (!rtdb) {
      console.warn("Firebase Admin not initialized");
      return NextResponse.json({ hasSuperAdmin: false });
    }

    // If a college name is provided, check if THIS specific college exists
    if (collegeName) {
      const collegesSnapshot = await rtdb.ref('colleges').once('value');
      const colleges = collegesSnapshot.val() || {};
      
      let collegeExists = false;
      for (const [, data] of Object.entries(colleges)) {
        const collegeData = data as { name: string };
        if (collegeData.name.toLowerCase() === collegeName.toLowerCase()) {
          collegeExists = true;
          break;
        }
      }
      
      return NextResponse.json({ 
        collegeExists,
        hasSuperAdmin: collegeExists 
      });
    }

    // Default: Check if ANY college exists (for backward compatibility)
    const snapshot = await rtdb.ref('colleges').limitToFirst(1).once('value');
    let hasSuperAdmin = false;
    let collegeCount = 0;
    
    if (snapshot.exists()) {
      const colleges = snapshot.val();
      if (colleges && typeof colleges === 'object') {
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
// app/api/super-admin/users/route.ts - FIXED WITH PROPER FILTERING
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

interface User {
  uid: string;
  name: string;
  email: string;
  phoneNumber?: string;
  roles: string[];
  departmentId: string;
  departmentName: string;
  status: string;
  collegeId?: string;
  [key: string]: unknown;
}

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const auth = getAuth();
    const rtdb = getRTDB();

    if (!auth || !rtdb) {
      console.error('Firebase Admin not initialized');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    
    // ✅ Get the current admin's data to know their college
    const adminSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const adminData = adminSnapshot.val() as User | null;
    
    if (!adminData?.roles?.includes("super_admin")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // ✅ THIS IS THE KEY - Get the admin's collegeId
    const adminCollegeId = adminData.collegeId;
    
    if (!adminCollegeId) {
      console.error("❌ Super Admin has no collegeId!");
      return NextResponse.json({ 
        error: "Admin has no college assigned" 
      }, { status: 400 });
    }

    console.log(`🔍 Fetching users for college: ${adminCollegeId}`);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || "";
    const departmentId = searchParams.get("departmentId") || "";
    const status = searchParams.get("status") || "";

    const usersSnapshot = await rtdb.ref("users").once("value");
    const users = usersSnapshot.val() as Record<string, User> | null || {};

    // ✅ CRITICAL FIX: Only show users from the SAME college
    let usersList = Object.entries(users)
      .filter(([, user]) => {
        // ✅ This is the fix - filter by collegeId
        return user.collegeId === adminCollegeId;
      })
      .map(([uid, user]) => ({
        uid,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber || "",
        roles: user.roles || [],
        departmentId: user.departmentId,
        departmentName: user.departmentName,
        status: user.status,
        createdAt: user.createdAt,
        collegeId: user.collegeId,
      }));

    // Apply additional filters
    if (search) {
      usersList = usersList.filter(user => 
        user.name?.toLowerCase().includes(search.toLowerCase()) ||
        user.email?.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (role) {
      usersList = usersList.filter(user => user.roles?.includes(role));
    }

    if (departmentId) {
      usersList = usersList.filter(user => user.departmentId === departmentId);
    }

    if (status) {
      usersList = usersList.filter(user => user.status === status);
    }

    console.log(`✅ Found ${usersList.length} users for college ${adminCollegeId}`);

    return NextResponse.json({ users: usersList });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
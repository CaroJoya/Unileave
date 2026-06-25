// app/api/super-admin/users/route.ts - FIXED
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
    
    const adminSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const adminData = adminSnapshot.val() as User | null;
    
    if (!adminData?.roles?.includes("super_admin")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const role = searchParams.get("role") || "";
    const departmentId = searchParams.get("departmentId") || "";
    const status = searchParams.get("status") || "";

    const usersSnapshot = await rtdb.ref("users").once("value");
    const users = usersSnapshot.val() as Record<string, User> | null || {};

    let usersList = Object.entries(users).map(([uid, user]) => ({
      uid,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber || "",
      roles: user.roles || [],
      departmentId: user.departmentId,
      departmentName: user.departmentName,
      status: user.status,
      createdAt: user.createdAt,
    }));

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

    return NextResponse.json({ users: usersList });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(request: Request) {
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
    
    const adminSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const adminData = adminSnapshot.val() as User | null;
    
    if (!adminData?.roles?.includes("super_admin")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const body = await request.json();
    const { name, email, phoneNumber, password, departmentId, roles } = body;

    if (!name || !email || !password || !departmentId || !roles || roles.length === 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    let userRecord;
    try {
      console.log("Creating Firebase Auth user with email:", email);
      userRecord = await auth.createUser({
        email,
        password,
        displayName: name,
      });
      console.log("Firebase Auth user created successfully with UID:", userRecord.uid);
    } catch (authError: unknown) {
      const error = authError as { code?: string; message?: string };
      console.error("Auth creation error:", error);
      if (error.code === "auth/email-already-exists") {
        return NextResponse.json({ error: "Email already exists" }, { status: 409 });
      }
      return NextResponse.json({ 
        error: `Failed to create user in Firebase Auth: ${error.message || "Unknown error"}` 
      }, { status: 500 });
    }

    const deptSnapshot = await rtdb.ref(`departments/${departmentId}`).once("value");
    const department = deptSnapshot.val() as { name: string } | null;

    if (!department) {
      await auth.deleteUser(userRecord.uid);
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    // Get admin's college ID
    const adminCollegeId = adminData.collegeId || "college_001";
    const collegeSnapshot = await rtdb.ref(`colleges/${adminCollegeId}`).once("value");
    const college = collegeSnapshot.val() as { name: string } | null;

    const userData = {
      uid: userRecord.uid,
      name,
      email,
      phoneNumber: phoneNumber || "",
      roles,
      departmentId,
      departmentName: department?.name || "",
      collegeId: adminCollegeId,
      collegeName: college?.name || "",
      status: "active",
      isEmployed: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await rtdb.ref(`users/${userRecord.uid}`).set(userData);
      console.log("User data saved to Realtime Database successfully");
    } catch (dbError) {
      console.error("Database save error:", dbError);
      await auth.deleteUser(userRecord.uid);
      return NextResponse.json({ error: "Failed to save user data" }, { status: 500 });
    }

    if (roles.includes("hod")) {
      try {
        const deptRef = rtdb.ref(`departments/${departmentId}`);
        const deptSnapshot = await deptRef.once("value");
        const deptData = deptSnapshot.val();

        if (deptData) {
          if (deptData.hodId) {
            console.warn(`Department ${departmentId} already has a HOD (${deptData.hodId}). Overwriting.`);
            const oldHodRef = rtdb.ref(`users/${deptData.hodId}`);
            await oldHodRef.update({
              departmentId: null,
              departmentName: null,
              updatedAt: new Date().toISOString(),
            });
          }
          
          await deptRef.update({
            hodId: userRecord.uid,
            hodName: name,
            updatedAt: new Date().toISOString(),
          });
          
          console.log(`Auto-assigned user ${userRecord.uid} as HOD of department ${departmentId}`);
        }
      } catch (hodError) {
        console.error("Failed to auto-assign HOD:", hodError);
      }
    }

    return NextResponse.json({ success: true, user: userData });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
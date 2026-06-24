import { NextResponse } from "next/server";
import { rtdb, auth } from "@/lib/firebase/admin";
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

    if (!auth || !rtdb) {
      console.error("Firebase Admin not initialized");
      return NextResponse.json(
        { error: "Server configuration error. Please check environment variables." },
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

    if (!auth || !rtdb) {
      console.error("Firebase Admin not initialized");
      return NextResponse.json(
        { error: "Server configuration error. Please check environment variables." },
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

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    // Create Firebase Auth user
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

    // Get department info
    const deptSnapshot = await rtdb.ref(`departments/${departmentId}`).once("value");
    const department = deptSnapshot.val() as { name: string } | null;

    if (!department) {
      // Clean up: delete the auth user if department doesn't exist
      await auth.deleteUser(userRecord.uid);
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    // Get college info
    const collegeSnapshot = await rtdb.ref("colleges/college_001").once("value");
    const college = collegeSnapshot.val() as { name: string } | null;

    // Create user data in Realtime Database
    const userData = {
      uid: userRecord.uid,
      name,
      email,
      phoneNumber: phoneNumber || "",
      roles,
      departmentId,
      departmentName: department?.name || "",
      collegeId: "college_001",
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
      // Clean up: delete the auth user if database save fails
      await auth.deleteUser(userRecord.uid);
      return NextResponse.json({ error: "Failed to save user data" }, { status: 500 });
    }

    // ✅ NEW: If the user has the 'hod' role, auto-assign as HOD of their department
    if (roles.includes("hod")) {
      try {
        const deptRef = rtdb.ref(`departments/${departmentId}`);
        const deptSnapshot = await deptRef.once("value");
        const deptData = deptSnapshot.val();

        if (deptData) {
          // Check if department already has a HOD (optional, but good practice)
          if (deptData.hodId) {
            console.warn(`Department ${departmentId} already has a HOD (${deptData.hodId}). Overwriting with new user.`);
            
            // Clear the old HOD's department reference
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
        } else {
          console.warn(`Department ${departmentId} not found for HOD assignment.`);
        }
      } catch (hodError) {
        console.error("Failed to auto-assign HOD:", hodError);
        // We don't want to fail the entire user creation if HOD assignment fails,
        // so we just log the error.
      }
    }

    return NextResponse.json({ success: true, user: userData });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
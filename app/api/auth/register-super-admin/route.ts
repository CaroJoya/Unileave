import { NextResponse } from "next/server";
import { auth, rtdb } from "@/lib/firebase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phoneNumber, password, collegeName } = body;

    console.log("=== REGISTRATION START ===");
    console.log("Email:", email);
    console.log("Name:", name);

    // Validate required fields
    if (!name || !email || !password || !collegeName) {
      console.log("Missing fields:", { name, email, password, collegeName });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check Firebase Admin initialization
    if (!auth) {
      console.error("Auth not initialized");
      return NextResponse.json(
        { error: "Firebase Admin not configured. Please check environment variables." },
        { status: 500 }
      );
    }

    if (!rtdb) {
      console.error("RTDB not initialized");
      return NextResponse.json(
        { error: "Realtime Database not configured." },
        { status: 500 }
      );
    }

    // Check if super admin already exists
    try {
      const snapshot = await rtdb.ref('users').once('value');
      let superAdminExists = false;
      
      if (snapshot.exists()) {
        const users = snapshot.val();
        if (users) {
          for (const userId in users) {
            const user = users[userId];
            if (user && user.roles && user.roles.includes('super_admin')) {
              superAdminExists = true;
              break;
            }
          }
        }
      }

      if (superAdminExists) {
        console.log("Super admin already exists");
        return NextResponse.json(
          { error: "Super admin already exists" },
          { status: 403 }
        );
      }
    } catch (dbError: any) {
      console.error("Database check error:", dbError);
      // Continue anyway - assume no super admin
    }

    // Create Firebase Auth user
    let userRecord;
    try {
      userRecord = await auth.createUser({
        email,
        password,
        displayName: name,
      });
      console.log("User created in Auth:", userRecord.uid);
    } catch (authError: any) {
      console.error("Auth creation error:", authError);
      if (authError.code === "auth/email-already-exists") {
        return NextResponse.json(
          { error: "Email already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create user: " + authError.message },
        { status: 500 }
      );
    }

    // Create user data for Realtime Database
    const userData = {
      uid: userRecord.uid,
      name,
      email,
      phoneNumber: phoneNumber || "",
      roles: ["super_admin"],
      status: "active",
      isEmployed: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to Realtime Database
    try {
      await rtdb.ref(`users/${userRecord.uid}`).set(userData);
      console.log("User saved to RTDB");
    } catch (rtdbError: any) {
      console.error("RTDB save error:", rtdbError);
      // Try to delete the auth user if DB save fails
      await auth.deleteUser(userRecord.uid);
      return NextResponse.json(
        { error: "Failed to save user data" },
        { status: 500 }
      );
    }

    // Create college document
    try {
      const collegeData = {
        id: "college_001",
        name: collegeName,
        principalId: null,
        principalName: null,
        address: "",
        isActive: true,
        createdBy: userRecord.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await rtdb.ref('colleges/college_001').set(collegeData);
      console.log("College saved to RTDB");
    } catch (collegeError: any) {
      console.error("College save error:", collegeError);
      // Non-critical, continue
    }

    // Create default Office department
    try {
      const officeDeptData = {
        id: "dept_office",
        name: "Office",
        collegeId: "college_001",
        collegeName: collegeName,
        hodId: null,
        hodName: null,
        isActive: true,
        createdBy: userRecord.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await rtdb.ref('departments/dept_office').set(officeDeptData);
      console.log("Office department saved to RTDB");
    } catch (deptError: any) {
      console.error("Department save error:", deptError);
      // Non-critical, continue
    }

    console.log("=== REGISTRATION SUCCESS ===");

    return NextResponse.json({
      success: true,
      message: "Super admin registered successfully",
      uid: userRecord.uid,
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to register super admin" },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { auth, rtdb } from "@/lib/firebase/admin";

// Define error type
interface FirebaseError {
  code?: string;
  message: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phoneNumber, password, collegeName } = body;

    console.log("=== REGISTRATION START ===");
    console.log("Email:", email);
    console.log("College Name:", collegeName);

    // Validate required fields
    if (!name || !email || !password || !collegeName) {
      console.log("Missing fields:", { name, email, password, collegeName });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check Firebase Admin initialization
    if (!auth || !rtdb) {
      console.error("Firebase Admin not initialized");
      return NextResponse.json(
        { error: "Firebase Admin not configured. Please check environment variables." },
        { status: 500 }
      );
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
    } catch (authError: unknown) {
      const error = authError as FirebaseError;
      console.error("Auth creation error:", error);
      if (error.code === "auth/email-already-exists") {
        return NextResponse.json(
          { error: "Email already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to create user: " + error.message },
        { status: 500 }
      );
    }

    // Create UNIQUE college ID
    const collegeId = `college_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    // Create college document with UNIQUE ID
    const collegeData = {
      id: collegeId,
      name: collegeName,
      principalId: null,
      principalName: null,
      address: "",
      isActive: true,
      createdBy: userRecord.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    try {
      await rtdb.ref(`colleges/${collegeId}`).set(collegeData);
      console.log("College saved to RTDB with ID:", collegeId);
    } catch (collegeError: unknown) {
      const error = collegeError as FirebaseError;
      console.error("College save error:", error);
      await auth.deleteUser(userRecord.uid);
      return NextResponse.json(
        { error: "Failed to save college data" },
        { status: 500 }
      );
    }

    // Create default Office department for this college
    const officeDeptData = {
      id: `dept_office_${collegeId}`,
      name: "Office",
      collegeId: collegeId,
      collegeName: collegeName,
      hodId: null,
      hodName: null,
      isActive: true,
      createdBy: userRecord.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    try {
      await rtdb.ref(`departments/${officeDeptData.id}`).set(officeDeptData);
      console.log("Office department saved to RTDB");
    } catch (deptError: unknown) {
      console.error("Department save error:", deptError);
      // Non-critical, continue
    }

    // Create user data for Realtime Database (linked to college)
    const userData = {
      uid: userRecord.uid,
      name,
      email,
      phoneNumber: phoneNumber || "",
      roles: ["super_admin"],
      status: "active",
      isEmployed: true,
      collegeId: collegeId,
      collegeName: collegeName,
      departmentId: officeDeptData.id,
      departmentName: "Office",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await rtdb.ref(`users/${userRecord.uid}`).set(userData);
      console.log("User saved to RTDB with college:", collegeId);
    } catch (rtdbError: unknown) {
      const error = rtdbError as FirebaseError;
      console.error("RTDB save error:", error);
      // Clean up: delete auth user and college
      await auth.deleteUser(userRecord.uid);
      await rtdb.ref(`colleges/${collegeId}`).remove();
      return NextResponse.json(
        { error: "Failed to save user data" },
        { status: 500 }
      );
    }

    console.log("=== REGISTRATION SUCCESS ===");
    console.log("College ID:", collegeId);
    console.log("User UID:", userRecord.uid);

    return NextResponse.json({
      success: true,
      message: "College and Super Admin registered successfully",
      collegeId: collegeId,
      uid: userRecord.uid,
    });
  } catch (error: unknown) {
    const err = error as FirebaseError;
    console.error("Registration error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to register" },
      { status: 500 }
    );
  }
}
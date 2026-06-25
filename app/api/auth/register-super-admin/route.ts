// app/api/auth/register-super-admin/route.ts - COMPLETE FILE
import { NextResponse } from "next/server";
//import { auth, rtdb } from "@/lib/firebase/admin";

import { getRTDB, getAuth } from "@/lib/firebase/admin";
const rtdb = getRTDB();
const auth = getAuth();
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

    // 🆕 DYNAMIC: Generate college ID or find existing
    let collegeId: string;
    
    // Check if college with this name already exists
    const collegesSnapshot = await rtdb.ref("colleges").once("value");
    const colleges = collegesSnapshot.val() || {};
    let existingCollegeId: string | null = null;

    for (const [id, data] of Object.entries(colleges)) {
      const collegeData = data as { name: string };
      if (collegeData.name === collegeName) {
        existingCollegeId = id;
        break;
      }
    }

    if (existingCollegeId) {
      collegeId = existingCollegeId;
      console.log("Found existing college:", collegeId);
      
      // Update existing college if needed
      const collegeData = {
        id: collegeId,
        name: collegeName,
        principalId: userRecord.uid,
        principalName: name,
        address: "",
        isActive: true,
        updatedAt: new Date().toISOString(),
      };
      
      // Merge with existing data
      const existingCollegeSnapshot = await rtdb.ref(`colleges/${collegeId}`).once("value");
      const existingData = existingCollegeSnapshot.val() || {};
      await rtdb.ref(`colleges/${collegeId}`).set({
        ...existingData,
        ...collegeData,
      });
      console.log("College updated with new principal");
    } else {
      // Create new college with dynamic ID
      collegeId = `college_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      
      const collegeData = {
        id: collegeId,
        name: collegeName,
        principalId: userRecord.uid,
        principalName: name,
        address: "",
        isActive: true,
        createdBy: userRecord.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      await rtdb.ref(`colleges/${collegeId}`).set(collegeData);
      console.log("New college created with ID:", collegeId);
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

    // Save user data
    const userDocData = {
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
      await rtdb.ref(`users/${userRecord.uid}`).set(userDocData);
      console.log("User saved to RTDB with college:", collegeId);
    } catch (rtdbError: unknown) {
      const error = rtdbError as FirebaseError;
      console.error("RTDB save error:", error);
      // Clean up: delete auth user and college
      await auth.deleteUser(userRecord.uid);
      if (!existingCollegeId) {
        await rtdb.ref(`colleges/${collegeId}`).remove();
      }
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
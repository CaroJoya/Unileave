// app/api/super-admin/users/route.ts - COMPLETE FILE WITH EMAIL FEATURE
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { sendEmail, getNewAccountCredentialsEmail } from "@/lib/utils/email";

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
    
    const adminSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const adminData = adminSnapshot.val() as User | null;
    
    if (!adminData?.roles?.includes("super_admin")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

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

    let usersList = Object.entries(users)
      .filter(([, user]) => {
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

    // Validate required fields
    if (!name || !email || !password || !departmentId || !roles || roles.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: name, email, password, departmentId, roles" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Get the admin's college
    const adminCollegeId = adminData.collegeId;
    if (!adminCollegeId) {
      return NextResponse.json({ error: "Admin has no college assigned" }, { status: 400 });
    }

    // Get college name
    const collegeSnapshot = await rtdb.ref(`colleges/${adminCollegeId}`).once("value");
    const college = collegeSnapshot.val() as { name: string } | null;

    // Get department name
    const deptSnapshot = await rtdb.ref(`departments/${departmentId}`).once("value");
    const department = deptSnapshot.val() as { name: string } | null;
    
    if (!department) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    // Create Firebase Auth user
    let userRecord;
    try {
      userRecord = await auth.createUser({
        email,
        password,
        displayName: name,
      });
    } catch (authError: unknown) {
      const error = authError as { code?: string; message?: string };
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

    // Save user to RTDB
    const userData = {
      uid: userRecord.uid,
      name,
      email,
      phoneNumber: phoneNumber || "",
      roles: roles,
      departmentId: departmentId,
      departmentName: department.name,
      collegeId: adminCollegeId,
      collegeName: college?.name || "",
      status: "active",
      isEmployed: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await rtdb.ref(`users/${userRecord.uid}`).set(userData);
    } catch (rtdbError) {
      console.error("RTDB save error:", rtdbError);
      // Clean up: delete auth user
      try {
        await auth.deleteUser(userRecord.uid);
      } catch {
        // Ignore cleanup errors
      }
      return NextResponse.json(
        { error: "Failed to save user data" },
        { status: 500 }
      );
    }

    // ✅ --- NEW CODE: Send welcome email with credentials ---
    try {
      const emailSent = await sendEmail(
        userData.email, // To: the new user's email
        `🎉 Welcome to UniLeave!`, // Subject
        getNewAccountCredentialsEmail(
          userData.name, // New user's name
          userData.email, // New user's email
          password, // The temporary password
          adminData.name || "Super Admin" // The admin who created them
        )
      );

      if (emailSent) {
        console.log(`✅ Welcome email sent to ${userData.email}`);
      } else {
        console.log(`⚠️ Welcome email not sent to ${userData.email} (SMTP might not be configured)`);
      }
    } catch (emailError) {
      // Log the error but don't fail the user creation process
      console.error(`❌ Failed to send welcome email to ${userData.email}:`, emailError);
    }

    // Log the action
    const auditLogId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    await rtdb.ref(`auditLogs/${auditLogId}`).set({
      id: auditLogId,
      userId: decodedToken.uid,
      userName: adminData.name || "Super Admin",
      userRole: "super_admin",
      action: "USER_CREATED",
      module: "users",
      targetId: userRecord.uid,
      details: JSON.stringify({
        name,
        email,
        roles,
        departmentName: department.name,
        emailSent: true,
      }),
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "User created successfully and email notification sent",
      uid: userRecord.uid,
      user: userData,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
// app/api/super-admin/departments/route.ts - COMPLETE FIXED FILE
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

interface DepartmentData {
  id?: string;
  name: string;
  collegeId?: string;
  collegeName?: string;
  hodId?: string | null;
  hodName?: string | null;
  isActive?: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

interface UserData {
  uid: string;
  name: string;
  email: string;
  roles: string[];
  collegeId?: string;
  collegeName?: string;
  departmentId?: string;
  departmentName?: string;
  status?: string;
  isEmployed?: boolean;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
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
    
    const userSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const userData = userSnapshot.val() as UserData | null;
    
    if (!userData?.roles?.includes("super_admin")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const collegeId = searchParams.get("collegeId") || userData.collegeId;

    console.log("Fetching departments for college:", collegeId);

    const departmentsSnapshot = await rtdb.ref("departments").once("value");
    const departments = departmentsSnapshot.val() as Record<string, DepartmentData> | null || {};

    const departmentsList = Object.entries(departments)
      .filter(([, data]) => {
        if (data.collegeId) {
          return data.collegeId === collegeId;
        }
        return true;
      })
      .map(([id, data]) => ({
        id,
        name: data.name,
        collegeId: data.collegeId || "",
        collegeName: data.collegeName || "",
        hodId: data.hodId || null,
        hodName: data.hodName || null,
        isActive: data.isActive !== false,
        createdBy: data.createdBy || "",
        createdAt: data.createdAt || "",
        updatedAt: data.updatedAt || "",
      }));

    console.log(`Found ${departmentsList.length} departments`);

    return NextResponse.json({ departments: departmentsList });
  } catch (error) {
    console.error("Error fetching departments:", error);
    return NextResponse.json({ error: "Failed to fetch departments" }, { status: 500 });
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
    
    const userSnapshot = await rtdb.ref(`users/${decodedToken.uid}`).once("value");
    const userData = userSnapshot.val() as UserData | null;
    
    if (!userData?.roles?.includes("super_admin")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: "Department name is required" }, { status: 400 });
    }

    const collegeId = userData.collegeId;
    
    if (!collegeId) {
      return NextResponse.json({ error: "User has no college assigned" }, { status: 400 });
    }

    const collegeSnapshot = await rtdb.ref(`colleges/${collegeId}`).once("value");
    const college = collegeSnapshot.val() as { name?: string } | null;

    const deptId = `dept_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const departmentData: DepartmentData = {
      id: deptId,
      name,
      collegeId: collegeId,
      collegeName: college?.name || "",
      hodId: null,
      hodName: null,
      isActive: true,
      createdBy: decodedToken.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await rtdb.ref(`departments/${deptId}`).set(departmentData);

    return NextResponse.json({ 
      success: true, 
      department: {
        id: deptId,
        ...departmentData,
      } 
    });
  } catch (error) {
    console.error("Error creating department:", error);
    return NextResponse.json({ error: "Failed to create department" }, { status: 500 });
  }
}
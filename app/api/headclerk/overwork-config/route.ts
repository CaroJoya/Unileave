// app/api/headclerk/overwork-config/route.ts - WITH SUPER ADMIN SUPPORT
import { NextResponse } from "next/server";
import { getRTDB, getAuth } from "@/lib/firebase/admin";
import { cookies } from "next/headers";
import { hasHeadClerkOrSuperAdminRights, getPerformerRole } from "@/lib/utils/roles";

interface OverworkConfig {
  id: string;
  conversionHours: number;
  minHoursPerEntry: number;
  maxHoursPerDay: number;
  autoConversionEnabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  collegeId: string;
}

interface UserRecord {
  uid: string;
  name: string;
  email: string;
  roles: string[];
  collegeId: string;
  collegeName: string;
}

export async function GET() {
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
    const userData = userSnapshot.val() as UserRecord | null;

    if (!userData || !hasHeadClerkOrSuperAdminRights(userData.roles || [])) {
      return NextResponse.json({ error: "Not authorized - Head Clerk or Super Admin only" }, { status: 403 });
    }

    const collegeId = userData.collegeId;
    
    if (!collegeId) {
      return NextResponse.json({ error: "User has no college assigned" }, { status: 400 });
    }

    const configRef = rtdb.ref(`colleges/${collegeId}/overworkConfig/overwork_config`);
    const snapshot = await configRef.once("value");
    let config = snapshot.val() as OverworkConfig | null;

    if (!config) {
      config = {
        id: "overwork_config",
        conversionHours: 5,
        minHoursPerEntry: 0.5,
        maxHoursPerDay: 24,
        autoConversionEnabled: true,
        updatedAt: null,
        updatedBy: null,
        collegeId: collegeId,
      };
      await configRef.set(config);
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error("Error fetching overwork config:", error);
    return NextResponse.json({ error: "Failed to fetch overwork config" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
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
    const userData = userSnapshot.val() as UserRecord | null;

    if (!userData || !hasHeadClerkOrSuperAdminRights(userData.roles || [])) {
      return NextResponse.json({ error: "Not authorized - Head Clerk or Super Admin only" }, { status: 403 });
    }

    const collegeId = userData.collegeId;
    
    if (!collegeId) {
      return NextResponse.json({ error: "User has no college assigned" }, { status: 400 });
    }

    const body = await request.json();
    const { conversionHours, minHoursPerEntry, maxHoursPerDay, autoConversionEnabled } = body;

    if (conversionHours !== undefined && (conversionHours < 1 || conversionHours > 24)) {
      return NextResponse.json({ error: "Conversion hours must be between 1 and 24" }, { status: 400 });
    }

    if (minHoursPerEntry !== undefined && (minHoursPerEntry < 0.5 || minHoursPerEntry > 24)) {
      return NextResponse.json({ error: "Minimum hours per entry must be between 0.5 and 24" }, { status: 400 });
    }

    if (maxHoursPerDay !== undefined && (maxHoursPerDay < 0.5 || maxHoursPerDay > 24)) {
      return NextResponse.json({ error: "Maximum hours per day must be between 0.5 and 24" }, { status: 400 });
    }

    const configRef = rtdb.ref(`colleges/${collegeId}/overworkConfig/overwork_config`);
    const snapshot = await configRef.once("value");
    const existingConfig = snapshot.val() as OverworkConfig | null;

    const performerRole = getPerformerRole(userData.roles || []);
    
    const updatedConfig = {
      id: "overwork_config",
      conversionHours: conversionHours !== undefined ? conversionHours : (existingConfig?.conversionHours || 5),
      minHoursPerEntry: minHoursPerEntry !== undefined ? minHoursPerEntry : (existingConfig?.minHoursPerEntry || 0.5),
      maxHoursPerDay: maxHoursPerDay !== undefined ? maxHoursPerDay : (existingConfig?.maxHoursPerDay || 24),
      autoConversionEnabled: autoConversionEnabled !== undefined ? autoConversionEnabled : (existingConfig?.autoConversionEnabled !== false),
      updatedBy: decodedToken.uid,
      updatedAt: new Date().toISOString(),
      collegeId: collegeId,
    };

    await configRef.set(updatedConfig);

    await rtdb.ref("auditLogs").push({
      userId: decodedToken.uid,
      userName: userData.name,
      userRole: performerRole,
      action: "OVERWORK_CONFIG_UPDATED",
      module: "overworkConfig",
      oldData: existingConfig ? {
        conversionHours: existingConfig.conversionHours,
        minHoursPerEntry: existingConfig.minHoursPerEntry,
        maxHoursPerDay: existingConfig.maxHoursPerDay,
        autoConversionEnabled: existingConfig.autoConversionEnabled,
      } : null,
      newData: {
        conversionHours: updatedConfig.conversionHours,
        minHoursPerEntry: updatedConfig.minHoursPerEntry,
        maxHoursPerDay: updatedConfig.maxHoursPerDay,
        autoConversionEnabled: updatedConfig.autoConversionEnabled,
      },
      details: JSON.stringify({
        performedBy: performerRole,
        collegeId,
      }),
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, config: updatedConfig });
  } catch (error) {
    console.error("Error updating overwork config:", error);
    return NextResponse.json({ error: "Failed to update overwork config" }, { status: 500 });
  }
}
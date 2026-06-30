// app/api/upload/route.ts
import { NextResponse } from "next/server";
import { getAuth, getRTDB } from "@/lib/firebase/admin";
import { cookies } from "next/headers";

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
    const userId = decodedToken.uid;

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const leaveType = formData.get("leaveType") as string || "unknown";

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    // Validate file size (max 16MB)
    const MAX_SIZE = 16 * 1024 * 1024; // 16MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 16MB limit" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "File type not allowed. Please upload PDF, DOC, DOCX, JPG, or PNG." },
        { status: 400 }
      );
    }

    // Convert file to base64 for storage
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Data = buffer.toString('base64');
    const mimeType = file.type;

    // Generate unique ID for the attachment
    const attachmentId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    
    // Store in Realtime Database
    const attachmentData = {
      id: attachmentId,
      userId: userId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: mimeType,
      leaveType: leaveType,
      data: base64Data, // Store base64 encoded file
      uploadedAt: new Date().toISOString(),
    };

    // Use a separate node for attachments
    await rtdb.ref(`attachments/${attachmentId}`).set(attachmentData);

    // Create a public URL that points to this attachment
    const attachmentUrl = `/api/attachment/${attachmentId}`;

    // Return the URL so the frontend can use it
    return NextResponse.json({
      success: true,
      url: attachmentUrl,
      attachmentId: attachmentId,
      fileName: file.name,
      fileSize: file.size,
    });

  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
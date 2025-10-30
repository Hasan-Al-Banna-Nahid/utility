// app/api/process-utility-bills/route.ts
import { NextRequest, NextResponse } from "next/server";

const N8N_WEBHOOK_URL =
  "http://n8n-simplifai.saavatar.xyz/webhook/dfef9d24-252b-477b-a37b-03c69a4efd28";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No files provided",
          uploadStatus: "failed",
        },
        { status: 400 }
      );
    }

    const processingResults = [];

    // Send each file to n8n webhook
    for (const file of files) {
      try {
        // Convert file to blob
        const fileBlob = new Blob([await file.arrayBuffer()], {
          type: file.type,
        });

        // Send to n8n webhook (fire and forget - don't wait for response)
        const n8nFormData = new FormData();
        n8nFormData.append("file", fileBlob, file.name);
        n8nFormData.append("fileName", file.name);
        n8nFormData.append("fileSize", file.size.toString());
        n8nFormData.append("uploadedAt", new Date().toISOString());

        // Send to n8n - don't await to avoid timeout
        fetch(N8N_WEBHOOK_URL, {
          method: "POST",
          body: n8nFormData,
        }).catch((error) => {
          console.error(`n8n webhook error for ${file.name}:`, error);
        });

        processingResults.push({
          fileName: file.name,
          fileSize: file.size,
          status: "sent_to_processor",
          processedAt: new Date().toISOString(),
        });
      } catch (error) {
        processingResults.push({
          fileName: file.name,
          fileSize: file.size,
          status: "failed",
          error: `Failed to send to processor: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          processedAt: new Date().toISOString(),
        });
      }
    }

    const successCount = processingResults.filter(
      (r) => r.status === "sent_to_processor"
    ).length;
    const uploadStatus = successCount > 0 ? "success" : "failed";

    return NextResponse.json({
      success: true,
      processed: processingResults.length,
      converted: successCount,
      failed: processingResults.filter((r) => r.status === "failed").length,
      uploadStatus,
      results: processingResults,
    });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        uploadStatus: "failed",
      },
      { status: 500 }
    );
  }
}

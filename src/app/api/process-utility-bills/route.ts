// app/api/process-utility-bills/route.ts
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const N8N_WEBHOOK_URL =
  "https://n8n.mkgrowth.ca/webhook/dfef9d24-252b-477b-a37b-03c69a4efd28";

// Ensure data directory exists
const DATA_DIR = path.join(process.cwd(), "data");
const LOGS_DIR = path.join(process.cwd(), "logs");

const ensureDataDir = async (): Promise<void> => {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
  if (!existsSync(LOGS_DIR)) {
    await mkdir(LOGS_DIR, { recursive: true });
  }
};

// Enhanced logging function
async function logToFile(
  message: string,
  type: "info" | "error" | "success" = "info"
): Promise<void> {
  try {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}\n`;
    const logFile = path.join(
      LOGS_DIR,
      `processing-${new Date().toISOString().split("T")[0]}.log`
    );

    await writeFile(logFile, logMessage, { flag: "a" });
    console.log(`[${type.toUpperCase()}] ${message}`);
  } catch (error) {
    console.error("Failed to write log:", error);
  }
}

// Convert file to ArrayBuffer for binary transmission
async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return await file.arrayBuffer();
}

// Send binary data directly to n8n
async function sendToN8nWebhook(
  files: {
    fileName: string;
    fileSize: number;
    binaryData: ArrayBuffer;
    processedAt: string;
  }[]
): Promise<void> {
  try {
    await logToFile(
      `Sending ${files.length} binary files to n8n webhook`,
      "info"
    );

    // Create FormData to send binary files
    const formData = new FormData();

    // Add metadata
    formData.append(
      "metadata",
      JSON.stringify({
        processedAt: new Date().toISOString(),
        totalFiles: files.length,
        fileNames: files.map((f) => f.fileName),
      })
    );

    // Add each binary file
    files.forEach((file, index) => {
      const blob = new Blob([file.binaryData], { type: "application/pdf" });
      formData.append(`file${index}`, blob, file.fileName);
    });

    // Send to n8n with binary data
    fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      body: formData, // Send as FormData with binary
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorText = await response.text();
          await logToFile(
            `n8n webhook failed with status ${response.status}: ${errorText}`,
            "error"
          );
        } else {
          await logToFile(
            `Successfully sent ${files.length} binary files to n8n webhook`,
            "success"
          );
        }
      })
      .catch(async (error) => {
        await logToFile(`n8n webhook failed: ${error}`, "error");
      });
  } catch (error) {
    await logToFile(`n8n webhook failed: ${error}`, "error");
  }
}

// Alternative method: Send as binary in JSON (if n8n supports it)
async function sendToN8nWebhookAsBinaryJSON(
  files: {
    fileName: string;
    fileSize: number;
    binaryData: ArrayBuffer;
    processedAt: string;
  }[]
): Promise<void> {
  try {
    await logToFile(
      `Sending ${files.length} files as binary JSON to n8n webhook`,
      "info"
    );

    // Convert ArrayBuffer to hex string for binary transmission
    const filesWithHex = await Promise.all(
      files.map(async (file) => {
        const buffer = Buffer.from(file.binaryData);
        return {
          fileName: file.fileName,
          fileSize: file.fileSize,
          data: buffer.toString("binary"), // Send as binary string
          processedAt: file.processedAt,
          mimeType: "application/pdf",
        };
      })
    );

    const payload = {
      processedAt: new Date().toISOString(),
      totalFiles: files.length,
      data: filesWithHex,
    };

    // Send to n8n
    fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorText = await response.text();
          await logToFile(
            `n8n webhook failed with status ${response.status}: ${errorText}`,
            "error"
          );
        } else {
          await logToFile(
            `Successfully sent ${files.length} files as binary to n8n webhook`,
            "success"
          );
        }
      })
      .catch(async (error) => {
        await logToFile(`n8n webhook failed: ${error}`, "error");
      });
  } catch (error) {
    await logToFile(`n8n webhook failed: ${error}`, "error");
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  await logToFile("=== Starting binary file upload to n8n ===", "info");

  try {
    await ensureDataDir();

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      await logToFile("No files provided in request", "error");
      return NextResponse.json(
        {
          success: false,
          error: "No files provided",
          uploadStatus: "failed",
        },
        { status: 400 }
      );
    }

    await logToFile(`Received ${files.length} files for binary upload`, "info");

    const processedFiles = [];
    const processingResults = [];

    for (const file of files) {
      try {
        await logToFile(
          `Processing binary file: ${file.name} (${file.size} bytes)`,
          "info"
        );

        // Convert file to ArrayBuffer (binary)
        const binaryData = await fileToArrayBuffer(file);
        const processedAt = new Date().toISOString();

        const fileData = {
          fileName: file.name,
          fileSize: file.size,
          binaryData: binaryData,
          processedAt: processedAt,
        };

        processedFiles.push(fileData);
        processingResults.push({
          fileName: file.name,
          fileSize: file.size,
          status: "converted",
          processedAt: processedAt,
        });

        await logToFile(
          `Converted ${file.name} to binary ArrayBuffer (${binaryData.byteLength} bytes)`,
          "success"
        );
      } catch (error) {
        await logToFile(`Failed to process ${file.name}: ${error}`, "error");
        processingResults.push({
          fileName: file.name,
          fileSize: file.size,
          status: "failed",
          error: `Processing failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          processedAt: new Date().toISOString(),
        });
      }
    }

    // Send all files to n8n as binary data
    // Choose one method based on your n8n configuration:

    // Method 1: FormData with binary files (Recommended)
    sendToN8nWebhook(processedFiles);

    // Method 2: JSON with binary data
    // sendToN8nWebhookAsBinaryJSON(processedFiles);

    const successCount = processingResults.filter(
      (r) => r.status === "converted"
    ).length;
    const totalCount = processingResults.length;

    const uploadStatus =
      successCount === totalCount
        ? "success"
        : successCount > 0
        ? "partial"
        : "failed";

    await logToFile(
      `Binary upload completed: ${successCount}/${totalCount} successful, upload status: ${uploadStatus}`,
      "success"
    );
    await logToFile("=== Binary file upload completed ===", "info");

    // Return simple response without n8n status
    return NextResponse.json({
      success: true,
      processed: processingResults.length,
      converted: successCount,
      failed: processingResults.filter((r) => r.status === "failed").length,
      uploadStatus,
      processingSummary: {
        totalFiles: processingResults.length,
        convertedFiles: successCount,
        failedConversions: processingResults.filter(
          (r) => r.status === "failed"
        ).length,
        totalDataSize: processingResults.reduce(
          (sum, r) => sum + (r.fileSize || 0),
          0
        ),
      },
      results: processingResults,
    });
  } catch (error) {
    await logToFile(`Binary upload failed: ${error}`, "error");
    return NextResponse.json(
      {
        success: false,
        error:
          "Internal server error: " +
          (error instanceof Error ? error.message : "Unknown error"),
        uploadStatus: "failed",
      },
      { status: 500 }
    );
  }
}

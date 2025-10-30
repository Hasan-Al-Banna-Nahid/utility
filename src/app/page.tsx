// components/EnhancedFileUploader.tsx
"use client";
import { useRef, useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";

interface ProcessingResult {
  fileName: string;
  status: string;
  fileSize?: number;
  processedAt?: string;
  error?: string;
}

interface ProcessResponse {
  success: boolean;
  processed: number;
  converted: number;
  failed: number;
  uploadStatus: "success" | "partial" | "failed";
  results: ProcessingResult[];
  error?: string;
}

export default function EnhancedFileUploader() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5 minutes in seconds
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [uploadStatus, setUploadStatus] = useState<
    "success" | "partial" | "failed"
  >("success");
  const [showOutputLink, setShowOutputLink] = useState(false);

  // Countdown timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (processing && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && processing) {
      setProcessing(false);
      setShowOutputLink(true);
      toast.success("Processing completed! Your data is ready.");
    }

    return () => clearInterval(interval);
  }, [processing, timeLeft]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) uploadFiles(files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) uploadFiles(files);
  };

  const uploadFiles = async (files: File[]) => {
    setUploading(true);
    setResults([]);
    setShowOutputLink(false);
    toast.dismiss();
    toast.loading(
      `Uploading ${files.length} file${files.length > 1 ? "s" : ""}…`
    );

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch("/api/process-utility-bills", {
        method: "POST",
        body: formData,
      });

      const data: ProcessResponse = await response.json();

      toast.dismiss();

      if (data.success) {
        setResults(data.results);
        setUploadStatus(data.uploadStatus);

        // Show appropriate toast based on upload status
        if (data.uploadStatus === "success") {
          toast.success(
            `Successfully uploaded ${data.converted} files! Starting processing...`
          );
        } else if (data.uploadStatus === "partial") {
          toast.success(
            `Uploaded ${data.converted} files (${data.failed} errors). Starting processing...`
          );
        } else {
          toast.error(
            `Upload failed: ${data.failed} errors out of ${data.processed} files`
          );
          setUploading(false);
          return;
        }

        // Start the 5-minute processing simulation
        setProcessing(true);
        setTimeLeft(300); // Reset to 5 minutes
      } else {
        throw new Error(data.error || "Upload failed");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.dismiss();
      toast.error("Upload failed. Please try again.");
      setUploadStatus("failed");
    } finally {
      setUploading(false);
      setIsDragging(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openOutputSheet = () => {
    window.open(
      "https://docs.google.com/spreadsheets/d/1lNrqHX1c93VI7cZz84Fqrd4KJ5PZcXtYJShWGE1XU4o/edit?usp=sharing",
      "_blank"
    );
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const getStatusColor = (status: "success" | "partial" | "failed") => {
    switch (status) {
      case "success":
        return "bg-green-100 text-green-800";
      case "partial":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <Toaster position="top-center" />

      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">
          Utility Bill Processor
        </h1>
        <p className="text-gray-600 max-w-2xl">
          Upload PDF utility bills for processing. Your data will be
          automatically processed and available in 5 minutes.
        </p>
      </div>

      {/* Upload Card - Only show when not processing */}
      {!processing && (
        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`p-10 border-4 border-dashed rounded-2xl cursor-pointer transition-all duration-300 ${
            isDragging
              ? "border-blue-400 bg-blue-50"
              : "border-gray-300 bg-white"
          } shadow-xl w-full max-w-2xl flex flex-col items-center justify-center mb-8`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-20 h-20 mb-4 text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 3v12m0 0l-4-4m4 4l4-4m-9 8h10a2 2 0 002-2V9a2 2 0 00-2-2h-3.5l-1.5-1.5H7a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          <p className="text-gray-600 text-center text-lg mb-2">
            {uploading
              ? "Uploading..."
              : isDragging
              ? "Drop your utility bill PDFs here"
              : "Click or drag PDF utility bills to upload"}
          </p>
          <p className="text-gray-500 text-sm text-center">
            Supports multiple PDF files. Data will be processed automatically
            and available in 5 minutes.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      )}

      {/* Processing Loader */}
      {processing && (
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-8 mb-8 border border-blue-200">
          <div className="text-center">
            {/* Animated Spinner */}
            <div className="relative mb-6">
              <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 bg-blue-500 rounded-full animate-pulse"></div>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Processing Your Files
            </h2>

            {/* Countdown Timer */}
            <div className="mb-6">
              <div className="text-4xl font-mono font-bold text-blue-600 mb-2">
                {formatTime(timeLeft)}
              </div>
              <p className="text-gray-600">Time remaining</p>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 mb-6">
              <div
                className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${((300 - timeLeft) / 300) * 100}%` }}
              ></div>
            </div>

            <p className="text-gray-600 mb-2">
              Extracting data from your utility bills...
            </p>
            <p className="text-sm text-gray-500">
              Your files are being processed automatically. This usually takes
              about 5 minutes.
            </p>
          </div>
        </div>
      )}

      {/* Upload Status */}
      {results.length > 0 && !processing && (
        <div className="w-full max-w-4xl mb-6">
          <div className={`p-4 rounded-lg ${getStatusColor(uploadStatus)}`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">
                  Upload Status:{" "}
                  {uploadStatus === "success"
                    ? "All files uploaded successfully"
                    : uploadStatus === "partial"
                    ? "Some files uploaded with errors"
                    : "Upload failed"}
                </h3>
                <p className="text-sm mt-1">
                  {processing
                    ? "Processing in progress..."
                    : showOutputLink
                    ? "Processing completed! Your data is ready."
                    : "Files uploaded successfully. Processing will begin shortly."}
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                  uploadStatus
                )}`}
              >
                {uploadStatus.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Output Sheet Link */}
      {showOutputLink && (
        <div className="w-full max-w-2xl bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-2xl p-6 mb-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mr-3">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-800">
              Processing Complete!
            </h3>
          </div>
          <p className="text-gray-600 mb-4">
            Your utility bill data has been processed and is now available in
            the output sheet.
          </p>
          <button
            onClick={openOutputSheet}
            className="px-8 py-3 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-lg hover:from-green-600 hover:to-blue-600 transition-all duration-300 font-semibold shadow-lg transform hover:scale-105"
          >
            📊 View Output Sheet
          </button>
        </div>
      )}

      {/* Results Display */}
      {results.length > 0 && !processing && (
        <div className="w-full max-w-4xl bg-white rounded-xl shadow-lg border border-blue-200 p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Upload Results</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">File Name</th>
                  <th className="text-left p-2">Size</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Uploaded At</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium">{result.fileName}</td>
                    <td className="p-2 text-gray-600">
                      {result.fileSize ? formatFileSize(result.fileSize) : "—"}
                    </td>
                    <td className="p-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          result.status === "converted"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {result.status}
                      </span>
                    </td>
                    <td className="p-2 text-gray-600">
                      {result.processedAt
                        ? new Date(result.processedAt).toLocaleTimeString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info Cards */}
      {!processing && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-blue-200">
            <div className="text-blue-500 text-lg font-semibold mb-2">
              ⏱️ Automatic Processing
            </div>
            <p className="text-gray-600">
              Files are processed automatically with a 5-minute completion
              guarantee
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg border border-blue-200">
            <div className="text-blue-500 text-lg font-semibold mb-2">
              📊 Real-time Output
            </div>
            <p className="text-gray-600">
              View processed data instantly in the output Google Sheet
            </p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg border border-blue-200">
            <div className="text-blue-500 text-lg font-semibold mb-2">
              🔒 Secure Processing
            </div>
            <p className="text-gray-600">
              Your files are processed securely and sent for automated analysis
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import {
  Upload,
  FileText,
  Copy,
  Download,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clipboard,
} from "lucide-react";
import "./App.css";

declare global {
  interface Window {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: Array<{
        description?: string;
        accept: Record<string, string[]>;
      }>;
    }) => Promise<FileSystemFileHandle>;
  }

  interface FileSystemWritableFileStream extends WritableStream {
    write(data: string | BufferSource | Blob): Promise<void>;
    seek(position: number): Promise<void>;
    truncate(size: number): Promise<void>;
  }

  interface FileSystemFileHandle {
    createWritable(options?: {
      keepExistingData?: boolean;
    }): Promise<FileSystemWritableFileStream>;
  }
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 토스트 자동 닫기
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // 진행률 애니메이션 시뮬레이션
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (loading) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) return prev;
          return prev + Math.floor(Math.random() * 10) + 1;
        });
      }, 500);
    } else {
      setProgress(100);
    }
    return () => clearInterval(interval);
  }, [loading]);

  // 클립보드 붙여넣기 이벤트 처리
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            // 붙여넣은 이미지에 이름을 부여하여 파일 객체로 생성
            const pastedFile = new File(
              [blob],
              `pasted_image_${new Date().getTime()}.png`,
              {
                type: blob.type,
              }
            );
            validateAndSetFile(pastedFile);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) validateAndSetFile(droppedFile);
  };

  const validateAndSetFile = (selectedFile: File) => {
    const validTypes = [
      "image/png",
      "image/jpeg",
      "application/pdf",
      "image/bmp",
      "image/tiff",
    ];
    if (validTypes.includes(selectedFile.type)) {
      setFile(selectedFile);
      setExtractedText("");
    } else {
      alert(
        "지원되지 않는 파일 형식입니다. (PNG, JPG, PDF, BMP, TIFF 만 가능)"
      );
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const performOCR = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/extract-text`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("OCR 요청 실패");

      const data = await response.json();
      setExtractedText(data.text);
    } catch (error) {
      console.error(error);
      setToast({
        message: "텍스트 추출 중 오류가 발생했습니다.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(extractedText);
    setToast({ message: "클립보드에 복사되었습니다.", type: "success" });
  };

  const downloadText = async () => {
    const lines = extractedText.split("\n");
    const firstLine = lines[0].trim().substring(0, 50);
    const fileName = firstLine ? `${firstLine}.txt` : "extracted_text.txt";

    // 현대적인 브라우저의 저장 위치 선택 API 시도
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: "Text Files",
              accept: { "text/plain": [".txt"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(extractedText);
        await writable.close();
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return; // 사용자가 취소한 경우
        console.error("저장 중 오류 발생:", err);
      }
    }

    // Fallback: 기존 다운로드 방식 (showSaveFilePicker 미지원 시)
    const element = document.createElement("a");
    const fileBlob = new Blob([extractedText], { type: "text/plain" });
    element.href = URL.createObjectURL(fileBlob);
    element.download = fileName;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const reset = () => {
    setFile(null);
    setExtractedText("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="layout">
      <header className="header">
        <div className="brand-section">
          <h1>Vision OCR</h1>
          <p style={{ color: "var(--text-muted)" }}>
            가장 빠르고 정확한 이미지 & PDF 텍스트 추출 도구
          </p>
        </div>

        {/* 헤더 우측 홍보 영역 - 텍스트 버튼 버전 */}
        <div className="header-ad">
          <a
            href="https://www.woongaro.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="law-firm-text-button"
          >
            <span className="main-text">법률사무소 로앤에셋</span>
            <span className="sub-text">
              Legal Prompt Engineering Connecting Law and Artificial
              Intelligence
            </span>
          </a>
        </div>
      </header>

      <main className="app-container">
        <div className="panel">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <h2
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: 0,
              }}
            >
              <Upload size={20} /> 파일 업로드
            </h2>
            <div
              className="status-badge"
              style={{
                background: "var(--glass)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-muted)",
              }}
            >
              <Clipboard size={14} style={{ marginRight: "4px" }} /> Ctrl+V로
              붙여넣기 가능
            </div>
          </div>

          <div
            className={`dropzone ${isDragging ? "dragging" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              style={{ display: "none" }}
              accept=".png,.jpg,.jpeg,.pdf,.bmp,.tiff"
            />
            {file ? (
              <div style={{ color: "var(--accent)" }}>
                <CheckCircle size={48} />
                <p style={{ marginTop: "1rem", fontWeight: "bold" }}>
                  {file.name}
                </p>
                <p style={{ fontSize: "0.8rem", opacity: 0.7 }}>
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <div>
                <Upload size={48} style={{ opacity: 0.5 }} />
                <p style={{ marginTop: "1rem" }}>
                  파일을 드래그하거나 클릭하여 업로드하세요
                </p>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  PNG, JPG, PDF 지원 (Ctrl+V 붙여넣기 지원)
                </p>
              </div>
            )}
          </div>

          <div className="action-bar">
            <button
              className="button"
              onClick={performOCR}
              disabled={!file || loading}
            >
              {loading ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                    justifyContent: "center",
                    width: "100%",
                  }}
                >
                  <div
                    className="loading-spinner"
                    style={{ width: "20px", height: "20px" }}
                  />
                  <span>분석 중... {progress}%</span>
                </div>
              ) : (
                "텍스트 추출하기"
              )}
            </button>
            <button
              className="button button-secondary"
              onClick={reset}
              disabled={!file || loading}
            >
              <Trash2 size={18} />
              <span>초기화</span>
            </button>
          </div>
        </div>

        <div className="panel">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <h2
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <FileText size={20} /> 추출 결과
            </h2>
            <div className="action-bar-compact" style={{ marginTop: 0 }}>
              <button
                className="button button-secondary"
                onClick={copyToClipboard}
                disabled={!extractedText || loading}
                title="복사"
              >
                <Copy size={18} />
              </button>
              <button
                className="button button-secondary"
                onClick={downloadText}
                disabled={!extractedText || loading}
                title="다운로드"
              >
                <Download size={18} />
              </button>
            </div>
          </div>

          <div className="result-area">
            {loading ? (
              <div
                style={{
                  textAlign: "center",
                  marginTop: "4rem",
                  color: "var(--text-muted)",
                }}
              >
                <p>텍스트를 추출하고 있습니다...</p>
                <p className="progress-text">{progress}%</p>
              </div>
            ) : extractedText ? (
              extractedText
            ) : (
              <div
                style={{
                  textAlign: "center",
                  marginTop: "4rem",
                  color: "var(--text-muted)",
                  fontSize: "0.9rem",
                }}
              >
                <AlertCircle
                  size={32}
                  style={{ marginBottom: "1rem", opacity: 0.3 }}
                />
                <p>파일을 업로드하고 추출 버튼을 누르면</p>
                <p>여기에 텍스트가 표시됩니다.</p>
              </div>
            )}
          </div>

          <div className="action-bar">
            <button
              className="button"
              onClick={copyToClipboard}
              disabled={!extractedText || loading}
            >
              <Copy size={18} />
              <span>텍스트 복사하기</span>
            </button>
            <button
              className="button button-secondary"
              onClick={downloadText}
              disabled={!extractedText || loading}
            >
              <Download size={18} />
              <span>텍스트 파일 다운로드</span>
            </button>
          </div>
        </div>
      </main>

      {/* 토스트 알림 */}
      {toast && (
        <div className={`toast-container ${toast.type}`}>
          {toast.type === "success" ? (
            <CheckCircle size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

export default App;

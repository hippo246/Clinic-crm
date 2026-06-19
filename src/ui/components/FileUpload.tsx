import React, { useState, useRef, useCallback } from 'react';

interface FileUploadProps {
  patientId: string;
  patientName: string;
  consultationId?: string;
  onUploadFiles: (files: File[]) => Promise<void>;
  onCancel: () => void;
}

export function FileUpload({ patientId, patientName, consultationId, onUploadFiles, onCancel }: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [documentType, setDocumentType] = useState('lab_report');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<Record<number, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    processFiles(selectedFiles);
  };

  const processFiles = (selectedFiles: File[]) => {
    const validFiles = selectedFiles.filter(file => {
      const validTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/jpg',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      return validTypes.includes(file.type) && file.size <= 10 * 1024 * 1024; // 10MB limit
    });

    if (validFiles.length !== selectedFiles.length) {
      alert('Some files were excluded. Only PDF, images, and documents up to 10MB are allowed.');
    }

    // Generate previews for images
    const newPreviewUrls: Record<number, string> = {};
    validFiles.forEach((file, index) => {
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        newPreviewUrls[index] = url;
      }
    });

    setPreviewUrls(prev => ({ ...prev, ...newPreviewUrls }));
    setFiles([...files, ...validFiles]);
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const selectedFiles = Array.from(e.dataTransfer.files || []);
    processFiles(selectedFiles);
  }, []);

  const removeFile = (index: number) => {
    // Clean up preview URL if it exists
    if (previewUrls[index]) {
      URL.revokeObjectURL(previewUrls[index]);
      setPreviewUrls(prev => {
        const newUrls = { ...prev };
        delete newUrls[index];
        return newUrls;
      });
    }
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      alert('Please select at least one file to upload');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      await onUploadFiles(files);
      setUploadProgress(100);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const documentTypes = [
    { value: 'lab_report', label: 'Lab Report', icon: 'ti-file-analytics' },
    { value: 'imaging', label: 'Imaging (X-Ray, MRI, CT)', icon: 'ti-scan' },
    { value: 'consent', label: 'Consent Form', icon: 'ti-writing' },
    { value: 'discharge_summary', label: 'Discharge Summary', icon: 'ti-file-description' },
    { value: 'referral', label: 'Referral Letter', icon: 'ti-file-export' },
    { value: 'insurance', label: 'Insurance Document', icon: 'ti-shield' },
    { value: 'id_document', label: 'ID Document', icon: 'ti-id' },
    { value: 'other', label: 'Other', icon: 'ti-file' },
  ];

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return 'ti-photo';
    if (file.type === 'application/pdf') return 'ti-file-pdf';
    if (file.type.includes('word')) return 'ti-file-word';
    return 'ti-file';
  };

  const getFileColor = (file: File) => {
    if (file.type.startsWith('image/')) return 'var(--green)';
    if (file.type === 'application/pdf') return 'var(--red)';
    if (file.type.includes('word')) return 'var(--blue)';
    return 'var(--muted)';
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: "100%", maxWidth: 600 }}>
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: "var(--radius)",
            background: "var(--accent-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <i className="ti ti-upload" style={{ fontSize: 18, color: "var(--accent)" }} />
          </div>
          <div>
            <div style={{ fontSize: "var(--font-md)", fontWeight: 700 }}>
              Upload Medical Documents
            </div>
            <div style={{ fontSize: "var(--font-xs)", color: "var(--muted)" }}>
              {patientName}
            </div>
          </div>
          <button className="btn-icon" onClick={onCancel}>
            <i className="ti ti-x" style={{ fontSize: 16 }} />
          </button>
        </div>

        <div style={{ padding: "20px" }}>
          <div style={{ marginBottom: 16 }}>
            <label className="field-label">Document Type *</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              style={{ width: "100%" }}
            >
              {documentTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="field-label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Brief description of the documents (optional)"
              style={{ width: "100%", resize: "vertical" }}
            />
          </div>

          <div
            style={{
              border: `2px dashed ${dragActive ? "var(--accent)" : "var(--border)"}`,
              borderRadius: "var(--radius)",
              padding: "2rem",
              textAlign: "center",
              marginBottom: 16,
              cursor: "pointer",
              background: dragActive ? "var(--accent-soft)" : "var(--surface2)",
              transition: "all 0.15s",
            }}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
            <i className="ti ti-cloud-upload" style={{ fontSize: 32, color: "var(--muted)", marginBottom: 8 }} />
            <p style={{ margin: 0, fontSize: "var(--font-sm)", color: "var(--text)", fontWeight: 500 }}>
              Click to select files or drag and drop
            </p>
            <p style={{ margin: "4px 0 0 0", fontSize: "var(--font-xs)", color: "var(--muted)" }}>
              PDF, Images, Documents up to 10MB
            </p>
          </div>

          {files.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ margin: "0 0 12px 0", fontSize: "var(--font-sm)", fontWeight: 600, color: "var(--text)" }}>
                Selected Files ({files.length})
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {files.map((file, index) => (
                  <div key={index} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 12,
                    background: "var(--surface2)",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)",
                  }}>
                    {previewUrls[index] ? (
                      <img
                        src={previewUrls[index]}
                        alt={file.name}
                        style={{ width: 48, height: 48, objectFit: "cover", borderRadius: "var(--radius-sm)" }}
                      />
                    ) : (
                      <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: "var(--radius-sm)",
                        background: "var(--surface3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}>
                        <i className={`ti ${getFileIcon(file)}`} style={{ fontSize: 20, color: getFileColor(file) }} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: "var(--font-sm)", fontWeight: 500, color: "var(--text)" }}>
                        {file.name}
                      </p>
                      <p style={{ margin: "2px 0 0 0", fontSize: "var(--font-xs)", color: "var(--muted)" }}>
                        {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="btn-icon"
                      title="Remove file"
                    >
                      <i className="ti ti-trash" style={{ fontSize: 14, color: "var(--red)" }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploading && (
            <div style={{ marginBottom: 16 }}>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
              </div>
              <p style={{ margin: "8px 0 0 0", fontSize: "var(--font-xs)", color: "var(--muted)", textAlign: "center" }}>
                Uploading... {uploadProgress}%
              </p>
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={onCancel}
              disabled={uploading}
              className="btn btn-ghost"
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
              className="btn btn-primary"
              style={{ flex: 1 }}
            >
              {uploading ? 'Uploading...' : 'Upload Files'}
            </button>
          </div>

          <div style={{
            marginTop: 16,
            padding: 12,
            background: "var(--amber-bg)",
            border: "1px solid var(--amber-border)",
            borderRadius: "var(--radius)",
          }}>
            <p style={{ margin: 0, fontSize: "var(--font-xs)", color: "var(--amber)" }}>
              <i className="ti ti-lock" style={{ marginRight: 4 }} />
              <strong>Security Notice:</strong> All uploaded files are encrypted and stored securely. Medical documents are HIPAA compliant.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

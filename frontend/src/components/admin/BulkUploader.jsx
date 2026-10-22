import React, { useState, useRef } from 'react';
import { UploadIcon, CheckIcon } from '../common/Icons';
import { adminApi } from '../../services/api';

export default function BulkUploader({ eventId, onUploadSuccess }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef(null);

  const handleFilesSelected = (e) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
      setErrorMessage('');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      setSelectedFiles(Array.from(e.dataTransfer.files));
      setErrorMessage('');
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !eventId) return;

    setIsUploading(true);
    setUploadProgress(`Uploading and indexing ${selectedFiles.length} photos...`);
    setErrorMessage('');

    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append('photos', file);
    });

    try {
      const response = await adminApi.uploadPhotos(eventId, formData);
      setUploadProgress(`Uploaded ${response.uploadedCount} photos successfully!`);
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (onUploadSuccess) onUploadSuccess(response.photos);
    } catch (err) {
      setErrorMessage(err.message || 'Bulk upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-4 rounded-2xl bg-[#1c1c24] border border-[#2a2a36] space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-white">Bulk Media Upload</h4>
          <p className="text-[11px] text-neutral-400">
            Upload high-res event photos. Mobile thumbnails and face descriptors will be generated automatically.
          </p>
        </div>
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-[#3a3a4c] hover:border-[#d4af37] rounded-xl p-6 text-center cursor-pointer transition-colors bg-[#141418]/60"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={handleFilesSelected}
        />
        <div className="w-10 h-10 mx-auto rounded-full bg-[#d4af37]/10 text-[#f7d070] flex items-center justify-center mb-2">
          <UploadIcon className="w-5 h-5" />
        </div>
        <p className="text-xs font-semibold text-neutral-300">
          Click to browse or drop high-res images here
        </p>
        <p className="text-[10px] text-neutral-500 mt-0.5">
          JPG, PNG, WEBP (Supports batch uploads)
        </p>
      </div>

      {selectedFiles.length > 0 && (
        <div className="flex items-center justify-between text-xs bg-[#141418] p-3 rounded-xl border border-[#2a2a36]">
          <span className="text-neutral-300 font-medium">
            Ready to upload: <strong className="text-amber-400">{selectedFiles.length} images</strong>
          </span>
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="px-4 py-2 rounded-lg bg-[#d4af37] text-black font-extrabold text-xs shadow hover:opacity-90 active:scale-95 transition disabled:opacity-50"
          >
            {isUploading ? 'Uploading...' : 'Start Upload'}
          </button>
        </div>
      )}

      {uploadProgress && (
        <div className="text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-800/50 p-2.5 rounded-lg flex items-center gap-2">
          <CheckIcon className="w-4 h-4 text-emerald-400" />
          <span>{uploadProgress}</span>
        </div>
      )}

      {errorMessage && (
        <div className="text-xs text-red-400 bg-red-950/40 border border-red-800/60 p-2.5 rounded-lg text-center">
          {errorMessage}
        </div>
      )}
    </div>
  );
}

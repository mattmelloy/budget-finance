import React, { useState, useCallback } from 'react';
import Icon from './Icon';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';

interface FileInputProps {
  onFileSelect: (file: File) => void;
  acceptedTypes: string;
}

const FileInput: React.FC<FileInputProps> = ({ onFileSelect, acceptedTypes }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  }, [onFileSelect]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={cn(
        "relative border-2 border-dashed rounded-lg p-12 text-center transition-colors",
        isDragging ? 'border-primary bg-primary/5' : 'border-input bg-background'
      )}
    >
      <Input
        type="file"
        id="file-upload"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        accept={acceptedTypes}
        onChange={handleChange}
      />
      <label htmlFor="file-upload" className="flex flex-col items-center justify-center space-y-2 text-muted-foreground cursor-pointer">
        <Icon name="upload" className="w-10 h-10 text-muted-foreground" />
        <span className="font-medium text-primary">Click to upload</span>
        <span>or drag and drop</span>
        <span className="text-xs">CSV or OFX files</span>
      </label>
    </div>
  );
};

export default FileInput;

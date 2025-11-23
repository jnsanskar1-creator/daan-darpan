import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, Users, FileSpreadsheet } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function BulkUserUpload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Generate and download template
  const downloadTemplate = () => {
    // Create CSV template with sample data
    const headers = ['username', 'password', 'name', 'email', 'mobile', 'address', 'role'];
    const sampleData = [
      'user1', 'password123', 'Sample User 1', 'user1@example.com', '9876543210', 'Sample Address 1', 'viewer',
      'user2', 'password123', 'Sample User 2', 'user2@example.com', '9876543211', 'Sample Address 2', 'operator'
    ];

    const csvContent = [
      headers.join(','),
      sampleData.slice(0, 7).join(','),
      sampleData.slice(7, 14).join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Template Downloaded",
      description: "CSV template downloaded successfully. Fill it with user data and upload.",
    });
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
        toast({
          title: "Invalid File Type",
          description: "Please upload a CSV or Excel file.",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch('/api/users/bulk-upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setSelectedFile(null);
      setUploading(false);
      
      toast({
        title: "Upload Successful",
        description: `${data.created} users created successfully. ${data.errors || 0} errors encountered.`,
      });
      
      // Reset file input
      const fileInput = document.getElementById('bulk-upload-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    },
    onError: (error: any) => {
      setUploading(false);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload users. Please check your file format.",
        variant: "destructive",
      });
    },
  });

  // Handle upload
  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    uploadMutation.mutate(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Bulk User Upload
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Template Download Section */}
        <div className="border rounded-lg p-4 bg-blue-50">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-medium text-blue-900 mb-2">Step 1: Download Template</h3>
              <p className="text-sm text-blue-800 mb-3">
                Download the CSV template with required columns and sample data.
              </p>
              <div className="text-xs text-blue-700 space-y-1">
                <p><strong>Required columns:</strong></p>
                <p>• username, password, name, email, mobile, address, role</p>
                <p><strong>Valid roles:</strong> admin, operator, viewer</p>
              </div>
            </div>
            <Button 
              onClick={downloadTemplate}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              <Download className="h-4 w-4" />
              Download Template
            </Button>
          </div>
        </div>

        {/* File Upload Section */}
        <div className="border rounded-lg p-4">
          <h3 className="font-medium mb-3">Step 2: Upload Filled Template</h3>
          
          <div className="space-y-4">
            {/* File Input */}
            <div>
              <input
                id="bulk-upload-input"
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                onClick={() => document.getElementById('bulk-upload-input')?.click()}
                variant="outline"
                className="w-full flex items-center gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Select CSV/Excel File
              </Button>
            </div>

            {/* Selected File Display */}
            {selectedFile && (
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">
                    {selectedFile.name}
                  </span>
                  <span className="text-xs text-green-600">
                    ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <Button
                  onClick={() => setSelectedFile(null)}
                  variant="ghost"
                  size="sm"
                  className="text-green-700 hover:text-green-900"
                >
                  Remove
                </Button>
              </div>
            )}

            {/* Upload Button */}
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="w-full flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading...' : 'Upload Users'}
            </Button>
          </div>
        </div>

        {/* Instructions */}
        <div className="text-sm text-gray-600 space-y-2">
          <p><strong>Instructions:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Download the template and fill in user details</li>
            <li>Ensure all required fields are completed</li>
            <li>Use valid roles: admin, operator, or viewer</li>
            <li>Mobile numbers should be 10 digits</li>
            <li>Usernames must be unique across the system</li>
            <li>Save as CSV format before uploading</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
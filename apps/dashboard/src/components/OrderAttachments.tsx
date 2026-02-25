import { useState } from 'react';
import { Upload, Button, List, Space, Typography, message, Popconfirm, Image } from 'antd';
import { UploadOutlined, DeleteOutlined, FileOutlined, FilePdfOutlined, DownloadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '@algreen/api-client';
import { useAuthStore } from '@algreen/auth';
import type { OrderAttachmentDto } from '@algreen/shared-types';
import { UserRole } from '@algreen/shared-types';
import { compressFile } from '../utils/compressImage';

const { Text } = Typography;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(contentType: string): boolean {
  return contentType.startsWith('image/');
}

interface OrderAttachmentsProps {
  orderId: string;
}

export function OrderAttachments({ orderId }: OrderAttachmentsProps) {
  const tenantId = useAuthStore((s) => s.tenantId);
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const canManage =
    user?.role === UserRole.SalesManager ||
    user?.role === UserRole.Manager ||
    user?.role === UserRole.Admin;

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ['order-attachments', orderId],
    queryFn: () => ordersApi.getAttachments(orderId).then((r) => r.data),
    enabled: !!orderId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const compressed = await compressFile(file);
      return ordersApi.uploadAttachment(orderId, compressed, tenantId!).then((r) => r.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-attachments', orderId] });
      message.success('File uploaded');
    },
    onError: (err: unknown) => {
      const code = (err as { response?: { data?: { error?: { code?: string; message?: string } } } })
        ?.response?.data?.error;
      message.error(code?.message || 'Upload failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) =>
      ordersApi.deleteAttachment(orderId, attachmentId, tenantId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-attachments', orderId] });
      message.success('Attachment deleted');
    },
    onError: () => {
      message.error('Delete failed');
    },
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      await uploadMutation.mutateAsync(file);
    } finally {
      setUploading(false);
    }
  };

  const getDownloadUrl = (attachment: OrderAttachmentDto) =>
    ordersApi.getAttachmentDownloadUrl(orderId, attachment.id);

  return (
    <div style={{ marginTop: 16 }}>
      <Text strong style={{ display: 'block', marginBottom: 8 }}>
        Attachments ({attachments.length}/10)
      </Text>

      {canManage && (
        <Upload
          beforeUpload={(file) => {
            handleUpload(file);
            return false;
          }}
          showUploadList={false}
          accept=".jpg,.jpeg,.png,.pdf"
          multiple
          disabled={uploading || attachments.length >= 10}
        >
          <Button
            icon={<UploadOutlined />}
            loading={uploading}
            disabled={attachments.length >= 10}
            size="small"
            style={{ marginBottom: 8 }}
          >
            Upload File
          </Button>
        </Upload>
      )}

      <List
        size="small"
        loading={isLoading}
        dataSource={attachments}
        locale={{ emptyText: 'No attachments' }}
        renderItem={(item: OrderAttachmentDto) => (
          <List.Item
            style={{ padding: '4px 0' }}
            actions={[
              <a
                key="download"
                href={getDownloadUrl(item)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <DownloadOutlined />
              </a>,
              ...(canManage
                ? [
                    <Popconfirm
                      key="delete"
                      title="Delete this attachment?"
                      onConfirm={() => deleteMutation.mutate(item.id)}
                      okText="Yes"
                      cancelText="No"
                    >
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>,
                  ]
                : []),
            ]}
          >
            <Space size={8}>
              {isImage(item.contentType) ? (
                <Image
                  src={getDownloadUrl(item)}
                  width={40}
                  height={40}
                  style={{ objectFit: 'cover', borderRadius: 4 }}
                  preview={{ src: getDownloadUrl(item) }}
                />
              ) : (
                <FilePdfOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
              )}
              <div>
                <Text ellipsis style={{ maxWidth: 200 }}>
                  {item.originalFileName}
                </Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {formatFileSize(item.fileSizeBytes)}
                </Text>
              </div>
            </Space>
          </List.Item>
        )}
      />
    </div>
  );
}

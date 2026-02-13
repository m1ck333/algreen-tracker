import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, Alert } from 'antd';
import { UserOutlined, LockOutlined, BankOutlined } from '@ant-design/icons';
import { useAuthStore } from '@algreen/auth';
import { useTranslation } from '@algreen/i18n';

const { Title } = Typography;

export function LoginPage() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuthStore();
  const { t } = useTranslation('dashboard');

  const onFinish = async (values: { email: string; password: string; tenantCode: string }) => {
    try {
      await login(values.email, values.password, values.tenantCode);
      navigate('/', { replace: true });
    } catch {
      // Error is handled by the store
    }
  };

  return (
    <Card style={{ width: 400, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          {t('login.title')}
        </Title>
        <Typography.Text type="secondary">{t('login.subtitle')}</Typography.Text>
      </div>

      {error && (
        <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />
      )}

      <Form form={form} onFinish={onFinish} layout="vertical" size="large">
        <Form.Item
          name="tenantCode"
          rules={[{ required: true, message: t('common:validation.enterTenantCode') }]}
        >
          <Input prefix={<BankOutlined />} placeholder={t('login.tenantCode')} />
        </Form.Item>

        <Form.Item
          name="email"
          rules={[
            { required: true, message: t('common:validation.enterEmail') },
            { type: 'email', message: t('common:validation.enterValidEmail') },
          ]}
        >
          <Input prefix={<UserOutlined />} placeholder={t('login.email')} />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[{ required: true, message: t('common:validation.enterPassword') }]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder={t('login.password')} />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" block loading={isLoading}>
            {t('common:actions.signIn')}
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}

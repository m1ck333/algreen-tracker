import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Card, Descriptions, Table, Button, Spin, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { productCategoriesApi } from '@algreen/api-client';
import { useTranslation } from '@algreen/i18n';

const { Title } = Typography;

export function CategoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('dashboard');

  const { data: category, isLoading } = useQuery({
    queryKey: ['product-categories', id],
    queryFn: () => productCategoriesApi.getById(id!).then((r) => r.data),
    enabled: !!id,
  });

  if (isLoading) return <Spin size="large" />;
  if (!category) return <Typography.Text>{t('admin.productCategories.categoryNotFound')}</Typography.Text>;

  return (
    <div>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/admin/product-categories')}
        style={{ marginBottom: 16 }}
      >
        {t('common:actions.back')}
      </Button>

      <Card>
        <Descriptions title={category.name} bordered>
          <Descriptions.Item label={t('common:labels.description')}>
            {category.description || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Title level={5} style={{ marginTop: 24 }}>
        {t('admin.productCategories.processes', { count: category.processes.length })}
      </Title>
      <Table
        dataSource={category.processes}
        rowKey="id"
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
        columns={[
          { title: t('common:labels.process'), dataIndex: 'processName' },
          { title: t('common:labels.code'), dataIndex: 'processCode' },
          { title: t('admin.productCategories.defaultComplexity'), dataIndex: 'defaultComplexity' },
          { title: t('common:labels.order'), dataIndex: 'sequenceOrder' },
        ]}
      />

      <Title level={5} style={{ marginTop: 24 }}>
        {t('admin.productCategories.dependencies', { count: category.dependencies.length })}
      </Title>
      <Table
        dataSource={category.dependencies}
        rowKey="id"
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
        columns={[
          { title: t('common:labels.process'), dataIndex: 'processCode' },
          { title: t('admin.productCategories.dependsOn'), dataIndex: 'dependsOnProcessCode' },
        ]}
      />
    </div>
  );
}

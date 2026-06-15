import { Card, Typography, Space, theme, List, Button, Tag, Row, Col } from 'antd';
import { DesktopOutlined, TabletOutlined, CheckOutlined, ThunderboltOutlined, ArrowLeftOutlined, MailOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useTranslation } from '@alblue/i18n';

const { Title, Paragraph, Text } = Typography;

export function AboutPage() {
  const { t } = useTranslation('dashboard');
  const { token } = theme.useToken();

  const dashboardFeatures = t('about.dashboardFeatures', { returnObjects: true }) as string[];
  const tabletFeatures = t('about.tabletFeatures', { returnObjects: true }) as string[];
  const techFeatures = t('about.techFeatures', { returnObjects: true }) as string[];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Tag color="blue" style={{ marginBottom: 12 }}>{t('common:appName')}</Tag>
        <Title level={1} style={{ margin: 0 }}>{t('about.title')}</Title>
        <Paragraph type="secondary" style={{ fontSize: 18, marginTop: 8 }}>
          {t('about.tagline')}
        </Paragraph>
        <Paragraph style={{ maxWidth: 720, margin: '16px auto 0' }}>
          {t('about.intro')}
        </Paragraph>
      </div>

      {/* Audience */}
      <Card style={{ marginBottom: 24 }}>
        <Title level={4} style={{ marginTop: 0 }}>{t('about.audience')}</Title>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Space align="start">
              <DesktopOutlined style={{ fontSize: 24, color: token.colorPrimary, marginTop: 4 }} />
              <Text>{t('about.audienceDashboard')}</Text>
            </Space>
          </Col>
          <Col xs={24} md={12}>
            <Space align="start">
              <TabletOutlined style={{ fontSize: 24, color: token.colorPrimary, marginTop: 4 }} />
              <Text>{t('about.audienceTablet')}</Text>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Dashboard + Tablet feature cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card
            title={<Space><DesktopOutlined /> {t('about.dashboardTitle')}</Space>}
            style={{ height: '100%' }}
          >
            <Paragraph type="secondary" style={{ marginTop: 0 }}>
              {t('about.dashboardSubtitle')}
            </Paragraph>
            <List
              dataSource={dashboardFeatures}
              renderItem={(item) => (
                <List.Item style={{ padding: '6px 0', border: 'none' }}>
                  <Space align="start">
                    <CheckOutlined style={{ color: token.colorSuccess, marginTop: 4 }} />
                    <Text>{item}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            title={<Space><TabletOutlined /> {t('about.tabletTitle')}</Space>}
            style={{ height: '100%' }}
          >
            <Paragraph type="secondary" style={{ marginTop: 0 }}>
              {t('about.tabletSubtitle')}
            </Paragraph>
            <List
              dataSource={tabletFeatures}
              renderItem={(item) => (
                <List.Item style={{ padding: '6px 0', border: 'none' }}>
                  <Space align="start">
                    <CheckOutlined style={{ color: token.colorSuccess, marginTop: 4 }} />
                    <Text>{item}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* Technical highlights */}
      <Card style={{ marginBottom: 24 }}>
        <Title level={4} style={{ marginTop: 0 }}>
          <Space><ThunderboltOutlined /> {t('about.techTitle')}</Space>
        </Title>
        <Row gutter={[16, 8]}>
          {techFeatures.map((f) => (
            <Col xs={24} sm={12} key={f}>
              <Space align="start">
                <CheckOutlined style={{ color: token.colorSuccess, marginTop: 4 }} />
                <Text>{f}</Text>
              </Space>
            </Col>
          ))}
        </Row>
      </Card>

      {/* CTA */}
      <Card style={{ textAlign: 'center', background: token.colorPrimaryBg, borderColor: token.colorPrimaryBorder }}>
        <Title level={3} style={{ marginTop: 0 }}>{t('about.ctaTitle')}</Title>
        <Paragraph>
          {t('about.ctaText')}{' '}
          <a href={`mailto:${t('about.ctaEmail')}`}>
            <MailOutlined /> {t('about.ctaEmail')}
          </a>
        </Paragraph>
        <Link to="/login">
          <Button type="primary" icon={<ArrowLeftOutlined />}>{t('about.backToLogin')}</Button>
        </Link>
      </Card>
    </div>
  );
}

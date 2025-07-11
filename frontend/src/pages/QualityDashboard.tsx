import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Typography, Tag, Avatar, Modal, Divider, Space, Tooltip, Spin, Alert } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, UserOutlined, MessageOutlined, DollarOutlined, ReloadOutlined } from '@ant-design/icons';
import DigitalClock from '../components/DigitalClock';

const { Title, Text, Paragraph } = Typography;

// 获取JWT Token
const getAuthToken = () => {
  return localStorage.getItem('token');
};

// API服务
const api = {
  get: async (url: string) => {
    const response = await fetch(`http://localhost:5555${url}`, {
      headers: { 'Authorization': `Bearer ${getAuthToken()}` },
    });
    if (!response.ok) throw new Error('Network response was not ok.');
    return response.json();
  },
};

// --- Updated Interfaces ---
interface LiveRoomStatus {
  id: string;
  title: string;
  description: string;
  url: string;
  cover: string;
  viewers: number;
  comments: { user: string; content: string }[];
  sales: number;
  duration: string;
  anchors: { name: string; avatar: string }[];
  status: string;
  enhanced?: string;
  isRealTime?: boolean;
}

interface DashboardData {
  totalRooms: number;
  liveRooms: number;
  totalViewers: number;
  totalSales: number;
  roi: number;
  avgViewers: number;
  systemInfo?: {
    version: string;
    activeConnections: number;
    totalMessages: number;
    uptime: number;
  };
}

interface RankingData {
  viewerRanking: { rank: number; name: string; viewers: number }[];
  interactionRanking: { rank: number; name: string; comments: number }[];
  conversionRanking: { rank: number; name: string; sales: number }[];
}

// --- Comment Ticker Component ---
const CommentTicker: React.FC<{ comments: { user: string; content: string }[] }> = ({ comments }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex(prevIndex => (prevIndex + 1) % comments.length);
    }, 2000);
    return () => clearInterval(timer);
  }, [comments.length]);

  if (!comments || comments.length === 0) {
    return <Text type="secondary">暂无评论</Text>;
  }

  return (
    <Space>
      <Text type="secondary">{comments[index].user}:</Text>
      <Text ellipsis={{ tooltip: comments[index].content }}>{comments[index].content}</Text>
    </Space>
  );
};

const QualityDashboard: React.FC = () => {
  const [liveRooms, setLiveRooms] = useState<LiveRoomStatus[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalRooms: 0,
    liveRooms: 0,
    totalViewers: 0,
    totalSales: 0,
    roi: 0,
    avgViewers: 0
  });
  const [rankingData, setRankingData] = useState<RankingData>({
    viewerRanking: [],
    interactionRanking: [],
    conversionRanking: []
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [modalUrl, setModalUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cardHeaderStyle: React.CSSProperties = {
    background: '#4C68E4',
    color: 'white',
  };

  // 获取看板数据
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 使用模拟数据替代不存在的API
      console.log('🔄 加载看板模拟数据...');
      
      // 模拟数据
      const mockStatsData: DashboardData = {
        totalRooms: 12,
        liveRooms: 8,
        totalViewers: 15420,
        totalSales: 89600,
        roi: 2.34,
        avgViewers: 1927,
        systemInfo: {
          version: 'v2.0.0',
          activeConnections: 8,
          totalMessages: 3456,
          uptime: 127
        }
      };
      
      const mockRankingsData: RankingData = {
        viewerRanking: [
          { rank: 1, name: '美妆直播间A', viewers: 3420 },
          { rank: 2, name: '服装直播间B', viewers: 2890 },
          { rank: 3, name: '数码直播间C', viewers: 2156 },
          { rank: 4, name: '美食直播间D', viewers: 1876 },
          { rank: 5, name: '家居直播间E', viewers: 1543 }
        ],
        interactionRanking: [
          { rank: 1, name: '美妆直播间A', comments: 890 },
          { rank: 2, name: '服装直播间B', comments: 756 },
          { rank: 3, name: '数码直播间C', comments: 623 },
          { rank: 4, name: '美食直播间D', comments: 567 },
          { rank: 5, name: '家居直播间E', comments: 445 }
        ],
        conversionRanking: [
          { rank: 1, name: '美妆直播间A', sales: 28900 },
          { rank: 2, name: '服装直播间B', sales: 23450 },
          { rank: 3, name: '数码直播间C', sales: 19800 },
          { rank: 4, name: '美食直播间D', sales: 15600 },
          { rank: 5, name: '家居直播间E', sales: 12300 }
        ]
      };
      
      const mockLiveStatusData: LiveRoomStatus[] = [
        {
          id: '1',
          title: '美妆直播间A',
          description: '今日美妆大促销',
          url: 'https://live.douyin.com/123456',
          cover: '',
          viewers: 3420,
          comments: [
            { user: '用户001', content: '主播好漂亮！' },
            { user: '用户002', content: '这个口红什么色号？' },
            { user: '用户003', content: '有优惠券吗？' }
          ],
          sales: 28900,
          duration: '2小时30分',
          anchors: [{ name: '小美', avatar: '' }],
          status: 'MONITORING',
          enhanced: '高清',
          isRealTime: true
        },
        {
          id: '2',
          title: '服装直播间B',
          description: '秋季新款上线',
          url: 'https://live.douyin.com/789012',
          cover: '',
          viewers: 2890,
          comments: [
            { user: '用户004', content: '这件衣服多少钱？' },
            { user: '用户005', content: '有我的尺码吗？' }
          ],
          sales: 23450,
          duration: '1小时45分',
          anchors: [{ name: '小芳', avatar: '' }],
          status: 'MONITORING',
          enhanced: '高清',
          isRealTime: true
        }
      ];

      setDashboardData(mockStatsData);
      setRankingData(mockRankingsData);
      setLiveRooms(mockLiveStatusData);
      
      console.log('✅ 看板模拟数据加载完成');
      
    } catch (error) {
      console.error('获取看板数据失败:', error);
      setError('获取看板数据失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };

  // 初始化数据
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // 定时刷新数据
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000); // 每30秒刷新一次
    return () => clearInterval(interval);
  }, []);

  const showLiveModal = (url: string) => {
    setModalUrl(url);
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setModalUrl('');
  };

  const rankingColumns = (dataKey: 'viewers' | 'comments' | 'sales') => [
    { title: '排名', dataIndex: 'rank', key: 'rank', width: 60 },
    { title: '直播间名称', dataIndex: 'name', key: 'name' },
    { 
      title: '数值', 
      dataIndex: dataKey, 
      key: dataKey, 
      width: 100,
      render: (value: number) => {
        if (dataKey === 'sales') return `¥${value}`;
        return value.toLocaleString();
      }
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'MONITORING': return 'red';
      case 'IDLE': return 'default';
      case 'OFFLINE': return 'orange';
      case 'ERROR': return 'volcano';
      default: return 'default';
    }
  };

  if (loading && liveRooms.length === 0) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>
          <Text>正在加载看板数据...</Text>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={2}>直播间智能看板</Title>
        <ReloadOutlined 
          style={{ fontSize: '18px', cursor: 'pointer' }} 
          onClick={fetchDashboardData}
          spin={loading}
        />
      </div>
      
      {error && (
        <Alert 
          message="数据加载错误" 
          description={error} 
          type="error" 
          closable 
          style={{ marginBottom: '24px' }}
          onClose={() => setError(null)}
        />
      )}

      <Row gutter={[24, 24]} align="stretch" style={{ marginBottom: '24px' }}>
        <Col xs={24} md={8}>
          <Card style={{ height: '100%' }} bodyStyle={{ padding: 0, height: '100%' }}>
              <DigitalClock />
          </Card>
        </Col>
        <Col xs={24} md={16}>
            <Row gutter={[16, 16]} align="stretch" style={{ height: '100%' }}>
                <Col flex={1}>
                    <Card style={{ height: '100%' }}>
                        <Statistic title="当前直播间数量" value={dashboardData.totalRooms} />
                        {dashboardData.systemInfo && (
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            引擎: {dashboardData.systemInfo.version}
                          </Text>
                        )}
                    </Card>
                </Col>
                <Col flex={1}>
                    <Card style={{ height: '100%' }}>
                        <Statistic 
                          title="正在直播数量" 
                          value={dashboardData.liveRooms} 
                          valueStyle={{ color: '#3f8600' }} 
                        />
                        {dashboardData.systemInfo && (
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            活跃连接: {dashboardData.systemInfo.activeConnections}
                          </Text>
                        )}
                    </Card>
                </Col>
                <Col flex={1}>
                    <Card style={{ height: '100%' }}>
                        <Statistic 
                          title="当前直播间观众总数" 
                          value={dashboardData.totalViewers} 
                          precision={0} 
                        />
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          平均: {dashboardData.avgViewers}
                        </Text>
                    </Card>
                </Col>
                <Col flex={1}>
                    <Card style={{ height: '100%' }}>
                        <Statistic 
                          title="成交总数" 
                          value={dashboardData.totalSales} 
                          precision={0} 
                          prefix="¥" 
                        />
                    </Card>
                </Col>
                <Col flex={1}>
                    <Card style={{ height: '100%' }}>
                        <Statistic 
                          title="实时ROI" 
                          value={dashboardData.roi} 
                          precision={2} 
                        />
                        {dashboardData.systemInfo && (
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            消息: {dashboardData.systemInfo.totalMessages}
                          </Text>
                        )}
                    </Card>
                </Col>
            </Row>
        </Col>
      </Row>

      <Title level={3}>排行榜单</Title>
      <Row gutter={16}>
        <Col span={8}>
          <Card title="观众数排行" headStyle={cardHeaderStyle}>
            <Table
              columns={rankingColumns('viewers')}
              dataSource={rankingData.viewerRanking}
              pagination={false}
              size="small"
              rowKey="rank"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="互动量排行" headStyle={cardHeaderStyle}>
            <Table
              columns={rankingColumns('comments')}
              dataSource={rankingData.interactionRanking}
              pagination={false}
              size="small"
              rowKey="rank"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="转化率排行" headStyle={cardHeaderStyle}>
            <Table
              columns={rankingColumns('sales')}
              dataSource={rankingData.conversionRanking}
              pagination={false}
              size="small"
              rowKey="rank"
            />
          </Card>
        </Col>
      </Row>

      <Title level={3} style={{ marginTop: '32px' }}>实时直播间状态</Title>
      <Row gutter={16}>
        {liveRooms.map((room) => (
          <Col key={room.id} xs={24} sm={12} md={8} lg={6} style={{ marginBottom: '16px' }}>
            <Card
              cover={
                <div style={{ position: 'relative' }}>
                  <img
                    alt={room.title}
                    src={room.cover}
                    style={{ height: '120px', objectFit: 'cover', width: '100%' }}
                    onClick={() => showLiveModal(room.url)}
                  />
                  <div style={{ 
                    position: 'absolute', 
                    top: '8px', 
                    right: '8px',
                    display: 'flex',
                    gap: '4px'
                  }}>
                    <Tag color={getStatusColor(room.status)}>
                      {room.status}
                    </Tag>
                    {room.isRealTime && (
                      <Tag color="green">实时</Tag>
                    )}
                    {room.enhanced && (
                      <Tag color="blue">{room.enhanced}</Tag>
                    )}
                  </div>
                </div>
              }
              bodyStyle={{ padding: '12px' }}
            >
              <div style={{ marginBottom: '8px' }}>
                <Text strong style={{ fontSize: '14px' }}>{room.title}</Text>
              </div>
              
              <Space style={{ marginBottom: '8px', width: '100%' }} direction="vertical" size={4}>
                <Space>
                  <UserOutlined style={{ color: '#1890ff' }} />
                  <Text>{room.viewers.toLocaleString()}</Text>
                  <DollarOutlined style={{ color: '#52c41a' }} />
                  <Text>¥{room.sales}</Text>
                </Space>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  直播时长: {room.duration}
                </Text>
              </Space>

              <div style={{ 
                height: '40px', 
                overflow: 'hidden',
                borderTop: '1px solid #f0f0f0',
                paddingTop: '8px'
              }}>
                <Space style={{ fontSize: '12px' }}>
                  <MessageOutlined style={{ color: '#fa8c16' }} />
                  <div style={{ flex: 1 }}>
                    <CommentTicker comments={room.comments} />
                  </div>
                </Space>
              </div>

              <div style={{ marginTop: '8px' }}>
                <Space>
                  {room.anchors.map((anchor, index) => (
                    <Tooltip key={index} title={anchor.name}>
                      <Avatar size="small" src={anchor.avatar} />
                    </Tooltip>
                  ))}
                </Space>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {liveRooms.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Text type="secondary">暂无直播间数据，请先在直播间管理页面添加直播间</Text>
        </div>
      )}

      <Modal
        title="直播间预览"
        open={modalVisible}
        onCancel={handleModalClose}
        footer={null}
        width={800}
      >
        {modalUrl && (
          <iframe
            src={modalUrl}
            style={{ width: '100%', height: '400px', border: 'none' }}
            title="Live Room Preview"
          />
        )}
      </Modal>
    </div>
  );
};

export default QualityDashboard; 
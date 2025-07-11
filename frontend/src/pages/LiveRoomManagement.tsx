import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Row, Col, Space, Typography, Alert, Badge, Form, Modal, Select, message, List, Avatar, Popconfirm, Tag, InputNumber, Upload, Radio, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, EyeOutlined, CopyOutlined, ReloadOutlined, UploadOutlined, FieldTimeOutlined, TeamOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

// 主播信息结构
interface AnchorInfo {
  id: string;
  name: string;
  avatar?: string;
  gender: 'male' | 'female';
  age?: number;
  rating?: 'top' | 'experienced' | 'regular' | 'probation';
  // 从后端获取的排班时段
  time_slot?: 'morning' | 'afternoon' | 'evening';
}

// 扩展的直播间数据结构
interface LiveRoom {
  id: string;
  title: string;
  url: string;
  streamer: string;
  platform: string;
  description: string;
  status: 'IDLE' | 'MONITORING' | 'ERROR';
  is_monitored: number; // 0 for not monitored, 1 for monitored
  created_at?: string;
  updated_at?: string;
  // 新增：由后端根据排班动态获取的主播信息
  scheduledAnchors: AnchorInfo[];
}

// 表单数据结构
interface RoomFormData {
  title: string;
  url: string;
  streamer: string;
  description?: string;
}

// 主播评级映射
const ratingMap = {
  top: { text: '销冠主播', color: 'gold' },
  experienced: { text: '成熟主播', color: 'orange' },
  regular: { text: '普通主播', color: 'blue' },
  probation: { text: '试岗主播', color: 'geekblue' },
};

// 优化：美化排班信息展示组件
const ScheduleDisplay: React.FC<{ anchors: AnchorInfo[], mode: 'current' | 'all' }> = ({ anchors, mode }) => {
  const timeSlotMap = {
    morning: '早上',
    afternoon: '下午',
    evening: '晚上',
  };

  const getCurrentTimeSlot = () => {
    const currentHour = new Date().getHours();
    if (currentHour >= 8 && currentHour < 12) return 'morning';
    if (currentHour >= 14 && currentHour < 18) return 'afternoon';
    if (currentHour >= 20 && currentHour < 24) return 'evening';
    return null;
  };

  if (mode === 'current') {
    const currentTimeSlot = getCurrentTimeSlot();
    const currentAnchors = anchors.filter(anchor => anchor.time_slot === currentTimeSlot);

    if (currentAnchors.length === 0) {
      return <div style={{ textAlign: 'center' }}><Text type="secondary" style={{ fontStyle: 'italic' }}>当前无在职主播</Text></div>;
    }

    return (
      <List
        size="small"
        dataSource={currentAnchors}
        renderItem={anchor => (
          <List.Item style={{ padding: '8px 0' }}>
            <List.Item.Meta
              avatar={<Avatar src={anchor.avatar || `https://i.pravatar.cc/40?u=${anchor.id}`} />}
              title={anchor.name}
              description={<Tag color="green">当前在职</Tag>}
            />
          </List.Item>
        )}
      />
    );
  }

  // mode === 'all'
  if (anchors.length === 0) {
    return <div style={{ textAlign: 'center' }}><Text type="secondary" style={{ fontStyle: 'italic' }}>今日无排班</Text></div>;
  }
  
  const groupedAnchors = {
    morning: anchors.filter(a => a.time_slot === 'morning'),
    afternoon: anchors.filter(a => a.time_slot === 'afternoon'),
    evening: anchors.filter(a => a.time_slot === 'evening'),
  };

  return (
    <Row gutter={8}>
      {Object.entries(groupedAnchors).map(([slot, slotAnchors]) => (
        <Col span={8} key={slot}>
          <div style={{ textAlign: 'center', backgroundColor: '#fafafa', padding: '8px', borderRadius: '4px', border: '1px solid #f0f0f0' }}>
            <Text style={{ fontSize: '12px', fontWeight: 500 }}>{timeSlotMap[slot]}</Text>
            <div style={{ marginTop: '4px', minHeight: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
              {slotAnchors.length > 0 ? (
                 <Avatar.Group maxCount={3} size="small">
                    {slotAnchors.map(anchor => (
                      <Tooltip title={anchor.name} key={anchor.id}>
                        <Avatar src={anchor.avatar || `https://i.pravatar.cc/32?u=${anchor.id}`} />
                      </Tooltip>
                    ))}
                  </Avatar.Group>
              ) : (
                <Text type="secondary" style={{ fontSize: '12px' }}>-</Text>
              )}
            </div>
          </div>
        </Col>
      ))}
    </Row>
  );
};


const LiveRoomManagement: React.FC = () => {
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [anchors, setAnchors] = useState<AnchorInfo[]>([]); // 所有主播数据
  const [loading, setLoading] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<LiveRoom | null>(null);
  const [batchUrls, setBatchUrls] = useState('');
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();
  // 新增：排班显示模式状态
  const [scheduleDisplayMode, setScheduleDisplayMode] = useState<'current' | 'all'>('current');


  // 获取认证头
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  };

  // 加载直播间列表
  const loadRooms = async () => {
    try {
      setLoading(true);
      console.log('🔄 开始加载直播间列表...');
      
      const headers = getAuthHeaders();
      console.log('📝 请求头:', headers);
      
      const response = await fetch('/api/rooms', {
        headers: headers
      });
      
      console.log('📡 API响应状态:', response.status, response.statusText);
      
      if (response.ok) {
        const result = await response.json();
        console.log('📊 API返回数据:', result);
        
        if (result.success && result.data) {
          console.log('✅ 设置房间数据:', result.data.length, '个房间');
          setRooms(result.data);
        } else {
          console.error('❌ API返回格式错误:', result);
          message.error(result.message || '加载直播间列表失败');
        }
      } else {
        const errorText = await response.text();
        console.error('❌ HTTP错误:', response.status, errorText);
        message.error('加载直播间列表失败');
      }
    } catch (error) {
      console.error('❌ 加载直播间列表失败:', error);
      message.error('加载直播间列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载主播列表
  const loadAnchors = async () => {
    try {
      const response = await fetch('/api/anchors', {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setAnchors(result.data);
        } else {
          console.error('主播API返回格式错误:', result);
          message.error(result.message || '加载主播列表失败');
        }
      } else {
        message.error('加载主播列表失败');
      }
    } catch (error) {
      console.error('加载主播列表失败:', error);
      message.error('加载主播列表失败');
    }
  };

  // 初始化加载
  useEffect(() => {
    loadRooms();
    loadAnchors();
  }, []);

  // 监听localStorage的变化，实现跨页面通信
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
        // 当其他页面的监控列表发生变化时，重新从数据库加载数据以同步状态
        if (e.key === 'stream_monitor_rooms') {
            console.log('🔄 检测到监控列表变化，从数据库重新加载...');
            loadRooms();
        }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
        window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // 添加单个直播间
  const handleAddRoom = async (values: RoomFormData) => {
    try {
      setLoading(true);
      console.log('🔄 开始添加直播间:', values);
      
      // 使用新的主播名称生成逻辑
      const defaultStreamerName = generateStreamerName(values.url);
      
      const requestBody = {
        title: values.title,
        url: values.url,
        streamer: defaultStreamerName, // 使用智能生成的主播名称
        description: '', // 默认空描述
        platform: '抖音', // 固定为抖音平台
        scheduledAnchors: [] // 添加时默认为空数组
      };
      
      console.log('📝 请求体:', requestBody);
      
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(requestBody)
      });

      console.log('📡 添加API响应状态:', response.status, response.statusText);
      const data = await response.json();
      console.log('📊 添加API返回数据:', data);
      
      if (data.success) {
        message.success('直播间添加成功');
        setIsAddModalOpen(false);
        addForm.resetFields();
        console.log('🔄 添加成功，准备刷新列表...');
        await loadRooms(); // 等待刷新完成
        console.log('✅ 列表刷新完成');
      } else {
        console.error('❌ 添加失败:', data);
        message.error(data.message || '添加直播间失败');
      }
    } catch (error) {
      console.error('❌ 添加直播间失败:', error);
      message.error('添加直播间失败');
    } finally {
      setLoading(false);
    }
  };

  // 批量添加直播间
  const handleBatchAdd = async () => {
    const urls = batchUrls.trim().split('\n').filter(url => url.trim());
    
    if (urls.length === 0) {
      message.error('请输入至少一个直播间URL');
      return;
    }

    try {
      setLoading(true);
      const roomsToAdd = urls.map((url, index) => {
        // 使用新的主播名称生成逻辑
        const roomId = extractRoomIdFromUrl(url);
        const defaultStreamerName = generateStreamerName(url);
        
        return {
          title: `直播间-${roomId || index + 1}`,
          url: url.trim(),
          streamer: defaultStreamerName, // 使用智能生成的主播名称
          platform: '抖音',
          description: '',
          scheduledAnchors: [] // 批量添加时默认为空数组
        };
      });

      const response = await fetch('/api/rooms/batch', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ rooms: roomsToAdd })
      });

      const data = await response.json();
      
      if (data.success) {
        message.success(`成功添加 ${data.data.success_count} 个直播间`);
        if (data.data.error_count > 0) {
          message.warning(`${data.data.error_count} 个直播间添加失败`);
        }
        setIsBatchModalOpen(false);
        setBatchUrls('');
        loadRooms();
      } else {
        message.error(data.message || '批量添加失败');
      }
    } catch (error) {
      console.error('批量添加失败:', error);
      message.error('批量添加失败');
    } finally {
      setLoading(false);
    }
  };

  // 编辑直播间
  const handleEditRoom = async (values: RoomFormData) => {
    if (!editingRoom) return;

    try {
      setLoading(true);
      
      const response = await fetch(`/api/rooms/${editingRoom.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: values.title,
          url: values.url,
          streamer: values.streamer,
          description: values.description
        })
      });

      const data = await response.json();
      
      if (data.success) {
        message.success('直播间更新成功');
        setIsEditModalOpen(false);
        setEditingRoom(null);
        editForm.resetFields();
        loadRooms();
      } else {
        message.error(data.message || '更新直播间失败');
      }
    } catch (error) {
      console.error('更新直播间失败:', error);
      message.error('更新直播间失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除直播间
  const handleDeleteRoom = async (roomId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      const data = await response.json();
      
      if (data.success) {
        message.success('直播间删除成功');
        loadRooms();
      } else {
        message.error(data.message || '删除直播间失败');
      }
    } catch (error) {
      console.error('删除直播间失败:', error);
      message.error('删除直播间失败');
    } finally {
      setLoading(false);
    }
  };

  // 传递到实时监控系统 (现在是更新监控状态)
  const handleSendToMonitor = async (room: LiveRoom) => {
    const isCurrentlyMonitored = room.is_monitored === 1;
    const newMonitorStatus = !isCurrentlyMonitored;

    try {
      const response = await fetch(`/api/rooms/${room.id}/monitor`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_monitored: newMonitorStatus }),
      });

      const result = await response.json();
      if (result.success) {
        // 更新前端状态
        setRooms(prevRooms => 
          prevRooms.map(r => 
            r.id === room.id ? { ...r, is_monitored: newMonitorStatus ? 1 : 0 } : r
          )
        );
        
        // 更新localStorage以同步监控页面
        const existingRooms = JSON.parse(localStorage.getItem('stream_monitor_rooms') || '[]');
        let updatedMonitorList;
        
        if (newMonitorStatus) {
          // 添加到监控列表
          const isAlreadyAdded = existingRooms.some((existing: any) => existing.id === room.id);
          if (!isAlreadyAdded) {
            const monitorData = {
              id: room.id,
              url: room.url,
              title: room.title,
              streamer: room.streamer,
              category: '娱乐'
            };
            updatedMonitorList = [...existingRooms, monitorData];
          } else {
            updatedMonitorList = existingRooms;
          }
          message.success(`直播间 "${room.title}" 已添加到监控`);
        } else {
          // 从监控列表移除
          updatedMonitorList = existingRooms.filter((r: any) => r.id !== room.id);
          message.success(`直播间 "${room.title}" 已从监控移除`);
        }
        
        localStorage.setItem('stream_monitor_rooms', JSON.stringify(updatedMonitorList));

      } else {
        message.error(result.message || '更新监控状态失败');
      }
    } catch (error) {
      console.error('更新监控状态失败:', error);
      message.error('更新监控状态失败');
    }
  };

  // 从URL中提取房间ID
  const extractRoomIdFromUrl = (url: string): string => {
    const match = url.match(/live\.douyin\.com\/(\d+)/);
    return match ? match[1] : '';
  };

  // 从URL中提取账号名称（更智能的提取）
  const extractAccountNameFromUrl = (url: string): string => {
    // 首先尝试提取房间ID
    const roomId = extractRoomIdFromUrl(url);
    if (roomId) {
      return `@抖音${roomId}`; // 使用@前缀表示抖音账号
    }
    
    // 如果没有房间ID，返回默认值
    return '主播账号';
  };

  // 生成更好的默认主播名称
  const generateStreamerName = (url: string): string => {
    const roomId = extractRoomIdFromUrl(url);
    if (roomId) {
      // 使用房间ID生成账号样式的名称
      return `@抖音${roomId}`;
    }
    return '主播账号';
  };

  // 打开编辑模态框
  const openEditModal = (room: LiveRoom) => {
    setEditingRoom(room);
    
    // 智能处理主播名称：如果是旧格式，建议新格式
    let suggestedStreamerName = room.streamer;
    if (room.streamer && (room.streamer.includes('主播-') || room.streamer === '主播' || room.streamer === '未知主播')) {
      // 如果是旧格式，生成新的账号格式建议
      suggestedStreamerName = generateStreamerName(room.url);
    }
    
    editForm.setFieldsValue({
      title: room.title,
      url: room.url,
      streamer: suggestedStreamerName,
      description: room.description,
    });
    setIsEditModalOpen(true);
  };

  // 复制URL
  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    message.success('URL已复制到剪贴板');
  };

  // 添加到监控列表
  const addToMonitor = (room: any) => {
    try {
      const storedRooms = JSON.parse(localStorage.getItem('stream_monitor_rooms') || '[]');
      const roomKey = room.id || room.room_id;
      const isMonitored = storedRooms.some((r: any) => r.id === roomKey);

      if (isMonitored) {
        message.warning('该直播间已在监控列表中');
        return;
      }

      const newMonitorRoom = {
        id: roomKey,
        url: room.stream_url || room.url,
        title: room.title,
        streamer: room.anchor_name || room.owner_name,
        category: room.category_name || '综合',
      };

      const updatedRooms = [...storedRooms, newMonitorRoom];
      localStorage.setItem('stream_monitor_rooms', JSON.stringify(updatedRooms));
      // 更新前端状态
      setRooms(prevRooms => prevRooms.map(r => r.id === roomKey ? { ...r, is_monitored: 1 } : r));
      message.success('已添加到监控列表');
    } catch (error) {
      console.error('添加到监控列表失败:', error);
      message.error('添加到监控列表失败');
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题和操作 */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <Title level={2} style={{ margin: 0 }}>🎥 抖音直播间管理</Title>
          <Space>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => setIsAddModalOpen(true)}
            >
              添加直播间
            </Button>
            <Button 
              icon={<PlusOutlined />}
              onClick={() => setIsBatchModalOpen(true)}
            >
              批量添加
            </Button>
            <Button 
              icon={<ReloadOutlined />}
              onClick={loadRooms}
              loading={loading}
            >
              刷新
            </Button>
          </Space>
        </div>
        
        <Alert
          message="快速添加直播间"
          description="只需输入URL和标题即可快速添加直播间，主播绑定和详细信息可后续编辑完善"
          type="info"
          showIcon
          style={{ marginBottom: '16px' }}
        />

        {/* 统计信息 */}
        <Row gutter={16} style={{ marginBottom: '16px' }}>
          <Col span={6}>
            <Card size="small" style={{ borderRadius: '6px', border: '1px solid #f0f0f0' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '600', color: '#1890ff', marginBottom: '4px' }}>
                  {rooms.length}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>总直播间</div>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ borderRadius: '6px', border: '1px solid #f0f0f0' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '600', color: '#52c41a', marginBottom: '4px' }}>
                  {rooms.filter(r => r.is_monitored === 1).length}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>监控中</div>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ borderRadius: '6px', border: '1px solid #f0f0f0' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '600', color: '#722ed1', marginBottom: '4px' }}>
                  {rooms.filter(r => r.is_monitored !== 1).length}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>待监控</div>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" style={{ borderRadius: '6px', border: '1px solid #f0f0f0' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '600', color: '#fa541c', marginBottom: '4px' }}>
                  {rooms.filter(r => r.status === 'ERROR').length}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>异常</div>
              </div>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 直播间卡片列表 */}
      <div style={{ marginTop: '24px' }}>
        <Title level={3} style={{ marginTop: '32px', marginBottom: '16px' }}>
          直播间列表
        </Title>

        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text>点击卡片可查看详情或进行操作。</Text>
          <Radio.Group
            value={scheduleDisplayMode}
            onChange={(e) => setScheduleDisplayMode(e.target.value)}
          >
            <Radio.Button value="current"><FieldTimeOutlined /> 当前在职</Radio.Button>
            <Radio.Button value="all"><TeamOutlined /> 今日排班</Radio.Button>
          </Radio.Group>
        </div>

        <Row gutter={[16, 16]}>
          {rooms.map((room) => (
            <Col xs={24} sm={12} md={8} key={room.id}>
              <Card
                title={room.title}
                hoverable
                extra={
                  <Space>
                    <Button icon={<EditOutlined />} size="small" onClick={() => openEditModal(room)} />
                    <Popconfirm
                      title="确定删除这个直播间吗?"
                      onConfirm={() => handleDeleteRoom(room.id)}
                      okText="确认"
                      cancelText="取消"
                    >
                      <Button icon={<DeleteOutlined />} danger size="small" />
                    </Popconfirm>
                  </Space>
                }
                actions={[
                  <Button type="link" icon={<EyeOutlined />} onClick={() => window.open(room.url, '_blank')}>
                    观看
                  </Button>,
                  <Button type="link" icon={<CopyOutlined />} onClick={() => copyUrl(room.url)}>
                    复制链接
                  </Button>,
                  <Button 
                    type={room.is_monitored ? "primary" : "default"}
                    danger={room.is_monitored ? true : false}
                    onClick={() => handleSendToMonitor(room)}
                  >
                    {room.is_monitored ? '取消监控' : '加入监控'}
                  </Button>
                ]}
              >
                <div style={{ marginBottom: '12px' }}>
                  <Text type="secondary">主播: {room.streamer}</Text><br/>
                  <Text type="secondary">平台: {room.platform}</Text><br/>
                </div>
                
                <Card type="inner" title="排班信息">
                  <ScheduleDisplay anchors={room.scheduledAnchors} mode={scheduleDisplayMode} />
                </Card>
              </Card>
            </Col>
          ))}
        </Row>

        {rooms.length === 0 && !loading && (
          <Card style={{ borderRadius: '8px', textAlign: 'center', border: '1px solid #f0f0f0' }}>
            <div style={{ padding: '40px 20px', color: '#bfbfbf' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📺</div>
              <Title level={4} type="secondary" style={{ marginBottom: '8px', fontSize: '16px' }}>
                暂无直播间
              </Title>
              <Text type="secondary" style={{ fontSize: '12px', color: '#8c8c8c' }}>
                快速输入URL和标题即可添加直播间
              </Text>
              <br />
              <Button 
                type="primary" 
                style={{ marginTop: '16px' }}
                onClick={() => setIsAddModalOpen(true)}
              >
                立即添加
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* 添加直播间模态框 */}
      <Modal
        title="➕ 添加抖音直播间"
        open={isAddModalOpen}
        onOk={() => addForm.submit()}
        onCancel={() => setIsAddModalOpen(false)}
        okText="添加"
        cancelText="取消"
        confirmLoading={loading}
        width={500}
      >
        <Alert
          message="快速添加"
          description="只需填写URL和标题，其他信息会自动生成，可稍后编辑完善"
          type="info"
          showIcon
          style={{ marginBottom: '16px' }}
        />
        
        <Form
          form={addForm}
          layout="vertical"
          onFinish={handleAddRoom}
        >
          <Form.Item
            name="url"
            label="直播间URL"
            rules={[
              { required: true, message: '请输入直播间URL' },
              { 
                pattern: /live\.douyin\.com\/\d+/, 
                message: '请输入有效的抖音直播间URL (如: https://live.douyin.com/123456)' 
              }
            ]}
          >
            <Input placeholder="https://live.douyin.com/123456" />
          </Form.Item>
          
          <Form.Item
            name="title"
            label="直播间标题"
            rules={[{ required: true, message: '请输入直播间标题' }]}
          >
            <Input placeholder="给直播间起个名字" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量添加模态框 */}
      <Modal
        title="📦 批量添加抖音直播间"
        open={isBatchModalOpen}
        onOk={handleBatchAdd}
        onCancel={() => setIsBatchModalOpen(false)}
        okText="批量添加"
        cancelText="取消"
        confirmLoading={loading}
        width={600}
      >
        <div style={{ marginBottom: '16px' }}>
          <Text strong>请输入抖音直播间URL，每行一个：</Text>
          <br />
          <Text type="secondary">例如：https://live.douyin.com/123456</Text>
        </div>
        
        <TextArea
          placeholder={`https://live.douyin.com/123456\nhttps://live.douyin.com/789012\nhttps://live.douyin.com/345678`}
          rows={8}
          value={batchUrls}
          onChange={(e) => setBatchUrls(e.target.value)}
        />
        
        <Alert
          message="批量添加说明"
          description="系统会为每个URL自动生成默认标题和主播名，添加后可以单独编辑每个直播间的详细信息"
          type="info"
          showIcon
          style={{ marginTop: '16px' }}
        />
      </Modal>

      {/* 编辑直播间模态框 */}
      <Modal
        title="✏️ 编辑直播间信息"
        open={isEditModalOpen}
        onOk={() => editForm.submit()}
        onCancel={() => setIsEditModalOpen(false)}
        okText="保存"
        cancelText="取消"
        confirmLoading={loading}
        width={600}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleEditRoom}
        >
          <Form.Item
            name="title"
            label="直播间标题"
            rules={[{ required: true, message: '请输入直播间标题' }]}
          >
            <Input placeholder="直播间标题" />
          </Form.Item>
          
          <Form.Item
            name="url"
            label="直播间URL"
            rules={[
              { required: true, message: '请输入直播间URL' },
              { 
                pattern: /live\.douyin\.com\/\d+/, 
                message: '请输入有效的抖音直播间URL' 
              }
            ]}
          >
            <Input placeholder="https://live.douyin.com/123456" />
          </Form.Item>
          
          <Form.Item
            name="streamer"
            label="主播账号名称"
            rules={[{ required: true, message: '请输入主播账号名称' }]}
            extra="建议格式：@抖音123456 或实际的主播昵称"
          >
            <Input 
              placeholder="如：@抖音123456 或 主播昵称" 
              prefix="👤"
            />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="备注描述"
          >
            <TextArea 
              placeholder="可选的备注信息" 
              rows={3}
              maxLength={200}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LiveRoomManagement;
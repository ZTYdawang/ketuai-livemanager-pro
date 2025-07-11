import React, { useState, useEffect, useRef } from 'react';
import {
  Row,
  Col,
  Card,
  Typography,
  Avatar,
  Tag,
  Button,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Divider,
  Space,
  DatePicker,
  Tooltip,
  notification,
  Collapse,
  Upload,
  message,
  Tabs,
  Alert,
  Empty,
} from 'antd';
import { 
  PlusOutlined, 
  LeftOutlined, 
  RightOutlined, 
  CloseCircleFilled, 
  EditOutlined, 
  DeleteOutlined, 
  ReloadOutlined, 
  CalendarOutlined, 
  TeamOutlined,
  HomeOutlined,
  WarningOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { DndContext, useDraggable, useDroppable, DragOverlay, DragEndEvent } from '@dnd-kit/core';
import type { UploadFile } from 'antd/es/upload/interface';

const { Title, Text } = Typography;
const { Option } = Select;
const { Panel } = Collapse;
const { TabPane } = Tabs;

// --- Interfaces ---
interface Anchor {
  id: string;
  name: string;
  avatar: string;
  gender: 'male' | 'female';
  age: number;
  rating: 'top' | 'experienced' | 'regular' | 'probation';
}

interface Schedule {
  id: string;
  anchor_id: string;
  date: string;
  time_slot: 'morning' | 'afternoon' | 'evening';
  room_id: string;
  anchor_name?: string;
  anchor_avatar?: string;
  anchor_rating?: string;
}

interface LiveRoom {
  id: string;
  title: string;
  url?: string;
  streamer?: string;
  platform?: string;
  status?: string;
}

// 时段定义
const TIME_SLOTS = {
  morning: { label: '早上班', time: '08:00-12:00', color: '#52c41a' },
  afternoon: { label: '下午班', time: '12:00-18:00', color: '#1890ff' },
  evening: { label: '晚上班', time: '18:00-24:00', color: '#722ed1' }
};

// 预设头像库
const PRESET_AVATARS = {
  male: [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=male1&backgroundColor=b6e3f4,c0aede,d1d4f9&eyes=default&mouth=default',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=male2&backgroundColor=b6e3f4,c0aede,d1d4f9&eyes=happy&mouth=smile',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=male3&backgroundColor=b6e3f4,c0aede,d1d4f9&eyes=wink&mouth=default',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=male4&backgroundColor=b6e3f4,c0aede,d1d4f9&eyes=surprised&mouth=smile',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=male5&backgroundColor=b6e3f4,c0aede,d1d4f9&eyes=default&mouth=twinkle',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=male6&backgroundColor=b6e3f4,c0aede,d1d4f9&eyes=happy&mouth=default'
  ],
  female: [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=female1&backgroundColor=ffdfbf,ffd5dc,c0aede&eyes=default&mouth=default&hair=longHairStraight',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=female2&backgroundColor=ffdfbf,ffd5dc,c0aede&eyes=happy&mouth=smile&hair=longHairWavy',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=female3&backgroundColor=ffdfbf,ffd5dc,c0aede&eyes=wink&mouth=default&hair=longHairCurly',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=female4&backgroundColor=ffdfbf,ffd5dc,c0aede&eyes=surprised&mouth=smile&hair=longHairStraight2',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=female5&backgroundColor=ffdfbf,ffd5dc,c0aede&eyes=default&mouth=twinkle&hair=longHairWavy2',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=female6&backgroundColor=ffdfbf,ffd5dc,c0aede&eyes=happy&mouth=default&hair=longHairCurly2'
  ]
};

// 根据性别获取默认头像
const getDefaultAvatar = (gender: 'male' | 'female') => {
  const avatars = PRESET_AVATARS[gender];
  return avatars[Math.floor(Math.random() * avatars.length)];
};

const ratingMap = {
  top: { text: '销冠主播', color: 'gold' },
  experienced: { text: '成熟主播', color: 'orange' },
  regular: { text: '普通主播', color: 'blue' },
  probation: { text: '试岗主播', color: 'geekblue' },
};

// 获取认证Token
const getAuthToken = () => localStorage.getItem('token');

// API调用函数
const api = {
  async get(url: string) {
    console.log('🚀 API GET:', url);
    const response = await fetch(`http://localhost:5555${url}`, {
      headers: { 'Authorization': `Bearer ${getAuthToken()}` },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const result = await response.json();
    console.log('📊 API GET 响应(原始):', result);
    
    // 检查响应结构
    if (!result || typeof result !== 'object') {
      console.error('❌ API响应格式错误:', result);
      return [];
    }

    // 返回数据部分
    if (result.success && result.data) {
      console.log('📊 API GET 响应(处理后):', result.data);
      return result.data;
    }
    
    console.warn('⚠️ API响应缺少success或data字段:', result);
    return result;
  },

  async post(url: string, body: any) {
    console.log('🚀 API POST:', url, body);
    const response = await fetch(`http://localhost:5555${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const result = await response.json();
    console.log('📊 API POST 响应:', result);
    
    return result.success ? result.data : result;
  },

  async put(url: string, body: any) {
    console.log('🚀 API PUT:', url, body);
    const response = await fetch(`http://localhost:5555${url}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const result = await response.json();
    console.log('📊 API PUT 响应:', result);
    
    return result.success ? result.data : result;
  },

  async delete(url: string, body?: any) {
    console.log('🚀 API DELETE:', url, body);
    const response = await fetch(`http://localhost:5555${url}`, {
      method: 'DELETE',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}` 
      },
      ...(body && { body: JSON.stringify(body) })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const result = await response.json();
    console.log('📊 API DELETE 响应:', result);
    
    return result.success ? result.data : result;
  }
};

// 拖拽项组件 - 显示主播信息
const DraggableAnchor: React.FC<{ 
  anchor: Anchor;
  isScheduled?: boolean; 
  scheduleInfo?: Schedule;
  isDisabled?: boolean;
  disabledReason?: string;
  dragId?: string; // 自定义拖拽ID
}> = ({ 
  anchor, 
  isScheduled = false, 
  scheduleInfo,
  isDisabled = false,
  disabledReason,
  dragId
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId || anchor.id, // 使用自定义ID或默认ID
    data: { anchor, scheduleInfo },
    disabled: isDisabled
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: isDragging ? 1000 : 1,
    opacity: isDragging ? 0.7 : (isDisabled ? 0.5 : 1),
  } : { opacity: isDisabled ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(!isDisabled ? listeners : {})}
      {...(!isDisabled ? attributes : {})}
      className={`draggable-anchor ${isScheduled ? 'scheduled' : ''} ${isDragging ? 'dragging' : ''} ${isDisabled ? 'disabled' : ''}`}
    >
      <Card 
        size="small" 
        hoverable={!isDragging && !isDisabled}
        style={{ 
          width: '100%', 
          maxWidth: 220,
          cursor: isDisabled ? 'not-allowed' : (isDragging ? 'grabbing' : 'grab'),
          border: isScheduled ? '2px solid #1890ff' : (isDisabled ? '1px solid #d9d9d9' : '1px solid #d9d9d9'),
          backgroundColor: isDisabled ? '#f5f5f5' : (isScheduled ? '#f6ffed' : '#fff'),
          marginBottom: 8
        }}
        bodyStyle={{ padding: '8px 12px' }}
      >
        <Row gutter={8} align="middle">
          <Col flex="none">
            <div style={{ position: 'relative' }}>
              <Avatar size={32} src={scheduleInfo?.anchor_avatar || anchor.avatar} />
              {isDisabled && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0,0,0,0.4)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  color: 'white',
                  fontWeight: 'bold'
                }}>
                  满
                </div>
              )}
            </div>
          </Col>
          <Col flex="auto">
            <div>
              <Text 
                strong 
                style={{ 
                  fontSize: '12px',
                  color: isDisabled ? '#999' : undefined,
                  display: 'block',
                  lineHeight: '14px',
                  marginBottom: '2px'
                }}
                ellipsis
              >
                {scheduleInfo?.anchor_name || anchor.name}
              </Text>
              <Tag 
                color={ratingMap[scheduleInfo?.anchor_rating as keyof typeof ratingMap || anchor.rating].color}
                style={{ fontSize: '10px', padding: '0 4px', lineHeight: '16px', marginRight: 0 }}
              >
                {ratingMap[scheduleInfo?.anchor_rating as keyof typeof ratingMap || anchor.rating].text}
              </Tag>
              {isDisabled && disabledReason && (
                <div style={{ marginTop: 2 }}>
                  <Text type="secondary" style={{ fontSize: '9px' }}>
                    {disabledReason}
                  </Text>
                </div>
              )}
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

// 放置区域组件
const DroppableTimeSlot: React.FC<{
  timeSlot: keyof typeof TIME_SLOTS; 
  schedules: Schedule[];
  anchors: Anchor[];
  onRemoveAnchor: (anchorId: string) => void;
  disabled?: boolean;
}> = ({ timeSlot, schedules, anchors, onRemoveAnchor, disabled = false }) => {
  const { isOver, setNodeRef } = useDroppable({
    id: timeSlot,
    data: { timeSlot },
    disabled
  });

  const slotInfo = TIME_SLOTS[timeSlot];
  const currentCount = schedules.length;
  const maxCount = 3;
  const remainingSlots = maxCount - currentCount;
  const isFull = currentCount >= maxCount;

  console.log(`🎯 渲染时段 ${timeSlot}:`, { 
    timeSlot,
    schedules, 
    currentCount, 
    remainingSlots,
    scheduleIds: schedules.map(s => s.id),
    anchorIds: schedules.map(s => s.anchor_id)
  });

  return (
    <Card 
      ref={setNodeRef}
      title={
        <Space size="small">
          <Tag color={slotInfo.color} style={{ fontSize: '11px', margin: 0 }}>
            {slotInfo.label}
          </Tag>
          <Text type="secondary" style={{ fontSize: '11px' }}>{slotInfo.time}</Text>
          <Tag color={isFull ? 'red' : currentCount > 0 ? 'orange' : 'default'} style={{ fontSize: '10px', margin: 0 }}>
            {currentCount}/{maxCount}
          </Tag>
        </Space>
      }
      style={{
        minHeight: 180,
        backgroundColor: disabled ? '#f5f5f5' : (isFull ? '#fff1f0' : (isOver ? '#f6ffed' : '#fafafa')),
        border: disabled ? '1px solid #d9d9d9' : (
          isFull ? '2px solid #ff7875' : (isOver ? '2px dashed #52c41a' : '1px solid #d9d9d9')
        ),
        opacity: disabled ? 0.6 : 1
      }}
      bodyStyle={{ minHeight: 140, padding: '8px' }}
      headStyle={{ padding: '8px 12px', minHeight: 'auto' }}
    >
      {disabled ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '30px 0', 
          color: '#bfbfbf',
          fontSize: '12px'
        }}>
          <WarningOutlined style={{ marginRight: 6, fontSize: '14px' }} />
          请先选择直播间
        </div>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
          {schedules.map(schedule => {
            console.log(`🎯 渲染排班卡片:`, {
              schedule,
              timeSlot,
              anchorId: schedule.anchor_id,
              availableAnchors: anchors.map(a => a.id)
            });
            
            const anchor = anchors.find(a => a.id === schedule.anchor_id);
            if (!anchor) {
              console.warn(`⚠️ 未找到主播:`, { 
                schedule, 
                anchors,
                anchorId: schedule.anchor_id,
                availableAnchors: anchors.map(a => a.id)
              });
              return null;
            }
            
            return (
              <div key={schedule.id} style={{ position: 'relative' }}>
                <DraggableAnchor 
                  anchor={anchor} 
                  isScheduled={true} 
                  scheduleInfo={schedule}
                  dragId={`scheduled-${schedule.id}`}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<CloseCircleFilled />}
                  style={{
                    position: 'absolute',
                    top: 4, 
                    right: 4, 
                    color: '#ff4d4f',
                    zIndex: 10,
                    width: 20,
                    height: 20,
                    minWidth: 20,
                    padding: 0,
                    fontSize: '12px'
                  }}
                  onClick={() => onRemoveAnchor(schedule.anchor_id)}
                />
              </div>
            );
          })}
          
          {/* 显示剩余空位 */}
          {!isFull && Array.from({ length: remainingSlots }).map((_, index) => (
            <div
              key={`empty-${index}`}
              className="empty-slot"
              style={{
                width: '100%',
                maxWidth: 220,
                height: 44,
                border: '2px dashed #d9d9d9',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#bfbfbf',
                fontSize: '11px',
                backgroundColor: isOver ? '#f6ffed' : 'transparent',
                marginBottom: 8
              }}
            >
              {index === 0 && schedules.length === 0 ? '拖拽主播到此时段' : '空位'}
            </div>
          ))}
          
          {/* 排班满员提示 */}
          {isFull && (
            <div style={{
              textAlign: 'center',
              padding: '6px',
              background: '#fff2f0',
              border: '1px solid #ffccc7',
              borderRadius: '4px',
              color: '#a8071a',
              fontSize: '11px'
            }}>
              此时段已排满（最多3个主播）
            </div>
          )}
        </Space>
      )}
    </Card>
  );
};

// 头像选择组件
const AvatarSelector: React.FC<{
  selectedAvatar: string;
  onAvatarChange: (avatar: string) => void;
  gender: 'male' | 'female';
}> = ({ selectedAvatar, onAvatarChange, gender }) => {
  const presetAvatars = PRESET_AVATARS[gender] || PRESET_AVATARS.male;

  return (
    <div>
      <Text type="secondary" style={{ display: 'block', marginBottom: '12px' }}>
        选择一个预设头像：
      </Text>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: '12px',
        maxHeight: '200px',
        overflowY: 'auto'
      }}>
        {presetAvatars.map((avatar, index) => (
          <div
            key={index}
            style={{
              border: selectedAvatar === avatar ? '2px solid #1890ff' : '2px solid #f0f0f0',
              borderRadius: '8px',
              padding: '8px',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s',
              backgroundColor: selectedAvatar === avatar ? '#f6ffed' : '#fff'
            }}
            onClick={() => onAvatarChange(avatar)}
          >
            <Avatar src={avatar} size={48} />
          </div>
        ))}
      </div>
      
      {selectedAvatar && (
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <Text type="secondary">当前选择的头像：</Text>
          <br />
          <Avatar src={selectedAvatar} size={64} style={{ marginTop: '8px' }} />
        </div>
      )}
    </div>
  );
};

// 主播卡片组件（主播池）
const AnchorCard: React.FC<{ 
  anchor: Anchor; 
  onEdit: (anchor: Anchor) => void;
  onDelete: (anchor: Anchor) => void;
}> = ({ anchor, onEdit, onDelete }) => (
  <Card 
    hoverable 
    style={{ width: '100%', maxWidth: 300, marginBottom: 16 }}
    bodyStyle={{ padding: '12px' }}
    actions={[
      <Button 
        key="edit"
        type="text" 
        icon={<EditOutlined />}
        size="small"
        onClick={() => {
          console.log('🖊️ 点击编辑按钮:', anchor);
          onEdit(anchor);
        }}
      >
        编辑
      </Button>,
      <Button 
        key="delete"
        type="text" 
        danger
        icon={<DeleteOutlined />}
        size="small"
        onClick={() => {
          console.log('🗑️ 点击删除按钮:', anchor);
          onDelete(anchor);
        }}
      >
        删除
      </Button>
    ]}
  >
     <Row gutter={12} align="middle">
      <Col flex="none">
        <Avatar size={48} src={anchor.avatar} />
      </Col>
      <Col flex="auto">
        <Title level={5} style={{ margin: 0, fontSize: '14px' }}>{anchor.name}</Title>
        <Text type="secondary" style={{ fontSize: '12px' }}>{anchor.gender === 'male' ? '男' : '女'} | {anchor.age}岁</Text>
      </Col>
    </Row>
    <Divider style={{ margin: '8px 0' }} />
    <Row justify="space-between" align="middle">
      <Text strong style={{ fontSize: '12px' }}>主播评级:</Text>
      <Tag color={ratingMap[anchor.rating].color} style={{ fontSize: '10px', margin: 0 }}>
        {ratingMap[anchor.rating].text}
      </Tag>
    </Row>
  </Card>
);

// 添加主播卡片
const AddAnchorCard: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <Card 
    hoverable 
    style={{ 
      width: '100%', 
      maxWidth: 300, 
      marginBottom: 16,
      height: 158 // 与主播卡片高度保持一致
    }}
    bodyStyle={{ padding: 0 }}
  >
    <Button
      type="dashed"
      onClick={onClick}
      style={{ 
        width: '100%', 
        height: '100%', 
        minHeight: 158,
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center',
        border: 'none'
      }}
    >
      <PlusOutlined style={{ fontSize: 24, marginBottom: 8 }} />
      <span style={{ fontSize: '14px' }}>录入新主播</span>
    </Button>
  </Card>
);

// 主组件
const AnchorManagement: React.FC = () => {
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [liveRooms, setLiveRooms] = useState<LiveRoom[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAnchor, setEditingAnchor] = useState<Anchor | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs());
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [draggedAnchor, setDraggedAnchor] = useState<Anchor | null>(null);
  const [form] = Form.useForm();

  // 加载主播列表
  const loadAnchors = async () => {
    if (loading) {
      console.log('⚠️ 正在加载中，跳过重复请求');
      return;
    }

    try {
      setLoading(true);
      console.log('🔄 开始加载主播列表...');
      
      const data = await api.get('/api/anchors');
      console.log('📊 获取到的主播数据:', data);
      
      // 确保数据格式正确
      const anchorsArray = Array.isArray(data) ? data.map(anchor => ({
        ...anchor,
        id: String(anchor.id) // 确保ID为字符串
      })) : [];
      
      console.log('📊 处理后的主播数组:', anchorsArray);
      setAnchors(anchorsArray);
      
      message.success(`加载成功，共 ${anchorsArray.length} 个主播`);
    } catch (error) {
      console.error('❌ 加载主播失败:', error);
      message.error('加载主播列表失败');
      setAnchors([]);
    } finally {
      setLoading(false);
    }
  };

  // 加载直播间列表
  const loadLiveRooms = async () => {
    try {
      console.log('🔄 开始加载直播间列表...');
      
      const data = await api.get('/api/rooms');
      console.log('📊 获取到的直播间数据:', data);
      
      const roomsArray = Array.isArray(data) ? data.map(room => ({
        ...room,
        id: String(room.id)
      })) : [];
      
      setLiveRooms(roomsArray);
      console.log('📊 处理后的直播间数组:', roomsArray);
      
      // 如果有直播间但没有选择直播间，自动选择第一个
      if (roomsArray.length > 0 && !selectedRoomId) {
        setSelectedRoomId(roomsArray[0].id);
      }
    } catch (error) {
      console.error('❌ 加载直播间失败:', error);
      message.error('加载直播间列表失败');
      setLiveRooms([]);
    }
  };

  // 加载排班数据
  const loadSchedules = async (date: string, roomId: string) => {
    if (!roomId) {
      setSchedules([]);
      return;
    }

    try {
      console.log('🔄 开始加载排班数据...', { date, roomId });
      
      const response = await api.get(`/api/schedules?date=${date}&roomId=${roomId}`);
      console.log('📊 获取到的排班数据(原始):', response);
      
      // 确保response是数组
      const scheduleData = Array.isArray(response) ? response : [];
      console.log('📊 转换后的排班数据:', scheduleData);
      
      if (scheduleData.length === 0) {
        console.warn('⚠️ 未获取到排班数据');
        setSchedules([]);
        return;
      }

      const schedulesArray = scheduleData.map(schedule => {
        console.log('🔄 处理单个排班:', schedule);
        return {
          ...schedule,
          id: String(schedule.id),
          anchor_id: String(schedule.anchor_id),
          room_id: String(schedule.room_id)
        };
      });
      
      console.log('📊 最终处理后的排班数组:', schedulesArray);
      setSchedules(schedulesArray);
      
    } catch (error) {
      console.error('❌ 加载排班失败:', error);
      message.error('加载排班数据失败');
      setSchedules([]);
    }
  };

  // 组件挂载时加载数据
  useEffect(() => {
    loadAnchors();
    loadLiveRooms();
  }, []);

  // 当选择日期或直播间改变时加载排班数据
  useEffect(() => {
    if (selectedDate && selectedRoomId) {
      loadSchedules(selectedDate.format('YYYY-MM-DD'), selectedRoomId);
    }
  }, [selectedDate, selectedRoomId]);

  // 获取指定时段的排班
  const getSchedulesByTimeSlot = (timeSlot: keyof typeof TIME_SLOTS): Schedule[] => {
    const filteredSchedules = schedules.filter(schedule => schedule.time_slot === timeSlot);
    console.log(`🔍 获取时段 ${timeSlot} 的排班:`, { 
      timeSlot,
      allSchedules: schedules,
      filtered: filteredSchedules,
      scheduleTimeSlots: schedules.map(s => s.time_slot)
    });
    return filteredSchedules;
  };

  // 获取主播在当前直播间的排班情况
  const getAnchorScheduleStatus = (anchorId: string) => {
    const anchorSchedules = schedules.filter(schedule => schedule.anchor_id === anchorId);
    const scheduledTimeSlots = anchorSchedules.map(schedule => schedule.time_slot);
    
    return {
      scheduledTimeSlots,
      isFullyScheduled: scheduledTimeSlots.length >= 3, // 三个时段都排了就是排满
      availableTimeSlots: Object.keys(TIME_SLOTS).filter(slot => 
        !scheduledTimeSlots.includes(slot as keyof typeof TIME_SLOTS)
      ) as (keyof typeof TIME_SLOTS)[]
    };
  };

  // 检查时段是否可以容纳更多主播（最多3个）
  const canTimeSlotAcceptMoreAnchors = (timeSlot: keyof typeof TIME_SLOTS): boolean => {
    const currentSchedules = getSchedulesByTimeSlot(timeSlot);
    return currentSchedules.length < 3;
  };

  // 检查主播是否可以拖拽到指定时段
  const canAnchorBeScheduledToTimeSlot = (anchorId: string, timeSlot: keyof typeof TIME_SLOTS): boolean => {
    // 检查时段是否还有空位
    if (!canTimeSlotAcceptMoreAnchors(timeSlot)) {
      return false;
    }
    
    // 检查主播是否已在该时段排班
    const anchorStatus = getAnchorScheduleStatus(anchorId);
    if (anchorStatus.scheduledTimeSlots.includes(timeSlot)) {
      return false;
    }
    
    return true;
  };

  // 获取可拖拽的主播（还有可排班时段的主播）
  const getDraggableAnchors = (): Anchor[] => {
    return anchors.filter(anchor => {
      const status = getAnchorScheduleStatus(anchor.id);
      // 只显示还有可排班时段的主播
      return status.availableTimeSlots.length > 0;
    });
  };

  // 获取已排满的主播
  const getFullyScheduledAnchors = (): Anchor[] => {
    return anchors.filter(anchor => {
      const status = getAnchorScheduleStatus(anchor.id);
      return status.isFullyScheduled;
    });
  };

  // 处理拖拽结束
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedAnchor(null);

    if (!over || !selectedRoomId) return;

    const dragId = active.id as string;
    const timeSlot = over.id as keyof typeof TIME_SLOTS;
    
    // 检查是否为有效的时段
    if (!TIME_SLOTS[timeSlot]) return;

    // 只允许主播池中的主播进行拖拽排班（以pool-开头的ID）
    if (!dragId.startsWith('pool-')) {
      console.log('🚫 非主播池主播，忽略拖拽操作:', dragId);
      return;
    }

    // 从拖拽ID中解析出实际的主播ID
    const anchorId = dragId.replace('pool-', '');
    
    console.log('🎯 拖拽结束:', { dragId, anchorId, timeSlot, roomId: selectedRoomId });

    // 前端验证：检查是否可以排班到该时段
    if (!canAnchorBeScheduledToTimeSlot(anchorId, timeSlot)) {
      const scheduleStatus = getAnchorScheduleStatus(anchorId);
      const currentSchedules = getSchedulesByTimeSlot(timeSlot);
      
      if (currentSchedules.length >= 3) {
        message.warning(`${TIME_SLOTS[timeSlot].label}已排满（最多3个主播）`);
      } else if (scheduleStatus.scheduledTimeSlots.includes(timeSlot)) {
        message.warning('该主播已在此时段排班');
      } else {
        message.warning('无法安排到此时段');
      }
      return;
    }

    try {
      // 注意：不需要先移除其他时段的排班，因为现在支持多时段排班
      
      // 添加新排班
      await api.post('/api/schedules', {
        anchorId,
        date: selectedDate.format('YYYY-MM-DD'),
        timeSlot,
        roomId: selectedRoomId
      });

      message.success('排班安排成功');
      await loadSchedules(selectedDate.format('YYYY-MM-DD'), selectedRoomId);
    } catch (error) {
      console.error('❌ 排班失败:', error);
      message.error('排班安排失败：' + String(error));
    }
  };

  // 从所有时段移除主播（删除主播时使用）
  const removeAnchorFromAllSlots = async (anchorId: string) => {
    const existingSchedules = schedules.filter(schedule => schedule.anchor_id === anchorId);
    
    for (const schedule of existingSchedules) {
      try {
        await api.delete('/api/schedules', {
          anchorId,
          date: selectedDate.format('YYYY-MM-DD'),
          timeSlot: schedule.time_slot,
          roomId: selectedRoomId
        });
      } catch (error) {
        console.error('❌ 移除排班失败:', error);
      }
    }
  };

  // 从指定时段移除主播
  const handleRemoveAnchor = async (anchorId: string, timeSlot?: keyof typeof TIME_SLOTS) => {
    try {
      if (!timeSlot) {
        // 如果未指定时段，查找该主播当前所在的时段
        const currentSchedule = schedules.find(schedule => schedule.anchor_id === anchorId);
        if (!currentSchedule) {
          message.warning('未找到该主播的排班记录');
          return;
        }
        timeSlot = currentSchedule.time_slot as keyof typeof TIME_SLOTS;
      }

      await api.delete('/api/schedules', {
        anchorId,
        date: selectedDate.format('YYYY-MM-DD'),
        timeSlot,
        roomId: selectedRoomId
      });

      message.success('移除排班成功');
      await loadSchedules(selectedDate.format('YYYY-MM-DD'), selectedRoomId);
    } catch (error) {
      console.error('❌ 移除排班失败:', error);
      message.error('移除排班失败：' + String(error));
    }
  };

  // 显示添加/编辑模态框
  const showModal = (anchor?: Anchor) => {
    console.log('📝 显示模态框:', anchor ? '编辑模式' : '新增模式');
    
    if (anchor) {
      // 编辑模式
      setEditingAnchor(anchor);
      setSelectedAvatar(anchor.avatar);
      form.setFieldsValue({
        name: anchor.name,
        gender: anchor.gender,
        age: anchor.age,
        rating: anchor.rating,
      });
    } else {
      // 新增模式
      setEditingAnchor(null);
      setSelectedAvatar(getDefaultAvatar('male'));
      form.resetFields();
      form.setFieldsValue({ gender: 'male' });
    }
    
    setIsModalOpen(true);
  };

  // 关闭模态框
  const handleCancel = () => {
    setIsModalOpen(false);
    setEditingAnchor(null);
    setSelectedAvatar('');
    form.resetFields();
  };

  // 保存主播
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      console.log('💾 保存主播数据:', values);
      
      const anchorData = {
        ...values,
        avatar: selectedAvatar || getDefaultAvatar(values.gender),
      };

      if (editingAnchor) {
        // 编辑模式
        console.log('✏️ 编辑主播:', editingAnchor.id, anchorData);
        await api.put(`/api/anchors/${editingAnchor.id}`, anchorData);
        message.success('主播信息更新成功');
      } else {
        // 新增模式
        console.log('➕ 新增主播:', anchorData);
        await api.post('/api/anchors', anchorData);
        message.success('主播创建成功');
      }

      handleCancel();
      await loadAnchors(); // 重新加载列表
    } catch (error) {
      console.error('❌ 保存主播失败:', error);
      message.error('保存失败：' + String(error));
    }
  };

  // 删除主播
  const handleDelete = (anchor: Anchor) => {
    console.log('🗑️ 准备删除主播:', anchor);
    
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除主播 "${anchor.name}" 吗？`,
      okText: '确认删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          console.log('🗑️ 执行删除主播:', anchor.id);
          // 先移除该主播的所有排班
          await removeAnchorFromAllSlots(anchor.id);
          // 删除主播
          await api.delete(`/api/anchors/${anchor.id}`);
          message.success('主播删除成功');
          await loadAnchors(); // 重新加载列表
          if (selectedRoomId) {
            await loadSchedules(selectedDate.format('YYYY-MM-DD'), selectedRoomId); // 重新加载排班
          }
        } catch (error) {
          console.error('❌ 删除主播失败:', error);
          message.error('删除失败：' + String(error));
        }
      },
    });
  };

  // 渲染直播间标签页
  const renderRoomTabs = () => {
    if (liveRooms.length === 0) {
      return (
        <div style={{ 
          padding: '40px 0', 
          textAlign: 'center',
          background: '#fafafa',
          border: '1px dashed #d9d9d9',
          borderRadius: '6px'
        }}>
          <HomeOutlined style={{ fontSize: '32px', color: '#bfbfbf', marginBottom: '16px' }} />
          <div>
            <Text type="secondary" style={{ fontSize: '16px' }}>还没有直播间数据</Text>
            <br />
            <Text type="secondary">请先到 <a href="/manage">直播间管理</a> 页面录入直播间信息</Text>
          </div>
        </div>
      );
    }

    return (
      <Tabs
        activeKey={selectedRoomId}
        onChange={setSelectedRoomId}
        type="card"
        size="small"
        style={{ 
          backgroundColor: '#f5f5f5',
          padding: '8px',
          borderRadius: '6px',
          marginBottom: '16px'
        }}
        tabBarStyle={{
          marginBottom: 0
        }}
      >
        {liveRooms.map(room => (
          <TabPane
            tab={
              <Space>
                <Text style={{ maxWidth: '150px' }} ellipsis>{room.title}</Text>
                {room.status && (
                  <Tag 
                    color={room.status === 'MONITORING' ? 'red' : room.status === 'IDLE' ? 'default' : 'orange'}
                  >
                    {room.status}
                  </Tag>
                )}
              </Space>
            }
            key={room.id}
          >
            <div style={{ padding: '8px 0' }}>
              <Space>
                <Text strong>当前直播间:</Text>
                <Text>{room.title}</Text>
                {room.streamer && <Text type="secondary">主播: {room.streamer}</Text>}
                {room.platform && <Tag>{room.platform}</Tag>}
              </Space>
            </div>
          </TabPane>
        ))}
      </Tabs>
    );
  };

  return (
    <div style={{ padding: '24px 0' }}>
      <Title level={2}>主播管理</Title>

      <Collapse defaultActiveKey={['anchors', 'schedule']} style={{ marginBottom: 24 }}>
        {/* 主播管理面板 */}
        <Panel 
          header={
            <Space>
              <TeamOutlined />
              <span>主播信息管理</span>
            </Space>
          } 
          key="anchors"
        >
          <Card 
            title="主播列表" 
            extra={
              <Button 
                icon={<ReloadOutlined />}
                onClick={loadAnchors}
                loading={loading}
                size="small"
              >
                刷新列表
              </Button>
            }
            bodyStyle={{ padding: '16px 12px' }}
          >
          {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Text>加载中...</Text>
            </div>
          ) : (
            <div className="anchor-grid">
                {anchors.map(anchor => (
                  <AnchorCard 
                    key={anchor.id}
                    anchor={anchor} 
                      onEdit={() => showModal(anchor)}
                      onDelete={() => handleDelete(anchor)}
                  />
              ))}
                <AddAnchorCard onClick={() => showModal()} />
            </div>
          )}
            
            {!loading && anchors.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Text type="secondary">还没有主播，点击上方按钮添加第一个主播吧！</Text>
              </div>
            )}
        </Card>
        </Panel>

        {/* 排班管理面板 */}
        <Panel 
          header={
            <Space>
              <CalendarOutlined />
              <span>拖拽排班系统</span>
            </Space>
          } 
          key="schedule"
        >
          <Card>
            {/* 直播间选择器 */}
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ marginBottom: 8, display: 'block' }}>直播间选择：</Text>
              {renderRoomTabs()}
            </div>

            {liveRooms.length === 0 ? (
              <Alert
                message="需要先录入直播间数据"
                description="排班系统需要关联直播间，请先到直播间管理页面录入直播间信息。"
                type="warning"
                showIcon
                action={
                  <Button size="small" type="primary" href="/manage">
                    去录入直播间
                  </Button>
                }
              />
            ) : !selectedRoomId ? (
              <Alert
                message="请选择一个直播间"
                description="请从上方标签页中选择要排班的直播间。"
                type="info"
                showIcon
              />
            ) : (
              <>
                {/* 日期选择器 */}
                <div style={{ marginBottom: 16 }}>
                  <Space>
                    <Text strong>选择日期:</Text>
                    <DatePicker 
                      value={selectedDate}
                      onChange={(date) => date && setSelectedDate(date)}
                      format="YYYY-MM-DD"
                    />
                    <Button 
                      icon={<LeftOutlined />}
                      onClick={() => setSelectedDate(selectedDate.subtract(1, 'day'))}
                    />
                    <Button 
                      icon={<RightOutlined />}
                      onClick={() => setSelectedDate(selectedDate.add(1, 'day'))}
                    />
                  </Space>
                </div>

                <DndContext 
                  onDragStart={(event) => {
                    const dragId = event.active.id as string;
                    let anchorId: string;
                    
                    // 解析拖拽ID获取主播ID
                    if (dragId.startsWith('pool-')) {
                      anchorId = dragId.replace('pool-', '');
                    } else if (dragId.startsWith('scheduled-')) {
                      // 从排班数据中获取主播ID
                      const scheduleId = dragId.replace('scheduled-', '');
                      const schedule = schedules.find(s => s.id === scheduleId);
                      anchorId = schedule?.anchor_id || '';
                    } else if (dragId.startsWith('full-')) {
                      anchorId = dragId.replace('full-', '');
                    } else {
                      anchorId = dragId; // 兜底逻辑
                    }
                    
                    const anchor = anchors.find(a => a.id === anchorId);
                    setDraggedAnchor(anchor || null);
                  }}
                  onDragEnd={handleDragEnd}
                >
                  <Row gutter={12}>
                    {/* 主播池 */}
                    <Col span={5}>
                      <Card 
                        title="主播池" 
                        style={{ minHeight: 400 }}
                        bodyStyle={{ padding: '8px' }}
                        headStyle={{ padding: '8px 12px' }}
                      >
                        <Space direction="vertical" style={{ width: '100%' }} size={4}>
                          {/* 可拖拽的主播 */}
                          {getDraggableAnchors().map(anchor => {
                            return (
                              <DraggableAnchor 
                                key={anchor.id} 
                                anchor={anchor}
                                isDisabled={false}
                                dragId={`pool-${anchor.id}`} // 主播池使用pool前缀
                              />
                            );
                          })}
                          
                          {/* 已排满的主播 */}
                          {getFullyScheduledAnchors().map(anchor => {
                            return (
                              <DraggableAnchor 
                                key={anchor.id} 
                                anchor={anchor}
                                isDisabled={true}
                                disabledReason="三个时段已排满"
                                dragId={`full-${anchor.id}`} // 已排满主播使用full前缀
                              />
                            );
                          })}
                          
                          {anchors.length === 0 && (
                            <div style={{ 
                              textAlign: 'center', 
                              padding: '30px 0', 
                              color: '#bfbfbf',
                              fontSize: '12px'
                            }}>
                              暂无主播数据
                            </div>
                          )}
                        </Space>
                      </Card>
                    </Col>

                    {/* 时段排班区域 */}
                    {Object.entries(TIME_SLOTS).map(([timeSlot, _]) => (
                      <Col span={6} key={timeSlot}>
                        <DroppableTimeSlot 
                          timeSlot={timeSlot as keyof typeof TIME_SLOTS}
                          schedules={getSchedulesByTimeSlot(timeSlot as keyof typeof TIME_SLOTS)}
                          anchors={anchors}
                          onRemoveAnchor={(anchorId) => handleRemoveAnchor(anchorId, timeSlot as keyof typeof TIME_SLOTS)}
                          disabled={!selectedRoomId}
                        />
                      </Col>
                    ))}
                    {/* 剩余空间 */}
                    <Col span={1}></Col>
                  </Row>

                  <DragOverlay>
                    {draggedAnchor && <DraggableAnchor anchor={draggedAnchor} />}
                  </DragOverlay>
                </DndContext>
              </>
            )}
          </Card>
        </Panel>
      </Collapse>

      {/* 添加/编辑模态框 */}
      <Modal 
        title={editingAnchor ? "编辑主播信息" : "新增主播"} 
        open={isModalOpen} 
        onOk={handleSave} 
        onCancel={handleCancel} 
        okText="保存" 
        cancelText="取消"
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item 
            name="gender" 
            label="主播性别" 
            rules={[{ required: true, message: '请选择主播性别' }]}
          >
            <Select 
              placeholder="选择性别"
              onChange={(value) => {
                if (!selectedAvatar) {
                  setSelectedAvatar(getDefaultAvatar(value));
                }
              }}
            >
              <Option value="male">男</Option>
              <Option value="female">女</Option>
            </Select>
          </Form.Item>
          
          <Form.Item label="主播头像">
            <AvatarSelector
              selectedAvatar={selectedAvatar}
              onAvatarChange={setSelectedAvatar}
              gender={form.getFieldValue('gender') || 'male'}
            />
          </Form.Item>
          
          <Form.Item 
            name="name" 
            label="主播名字" 
            rules={[{ required: true, message: '请输入主播名字' }]}
          >
            <Input placeholder="请输入主播姓名" />
          </Form.Item>
          
          <Form.Item 
            name="age" 
            label="主播年龄" 
            rules={[{ required: true, message: '请输入主播年龄' }]}
          >
            <InputNumber 
              min={18} 
              max={60} 
              style={{ width: '100%' }} 
              placeholder="请输入年龄" 
            />
          </Form.Item>
          
          <Form.Item 
            name="rating" 
            label="主播评级" 
            rules={[{ required: true, message: '请选择主播评级' }]}
          >
            <Select placeholder="选择主播评级">
              <Option value="probation">试岗主播</Option>
              <Option value="regular">普通主播</Option>
              <Option value="experienced">成熟主播</Option>
              <Option value="top">销冠主播</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 拖拽样式 */}
      <style>{`
        .draggable-anchor {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .draggable-anchor.dragging {
          transform: rotate(3deg) scale(1.02);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        }
        .draggable-anchor.scheduled {
          box-shadow: 0 2px 8px rgba(24, 144, 255, 0.2);
        }
        .draggable-anchor.disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }
        .draggable-anchor.disabled:hover {
          transform: none;
        }
        
        /* 空位占位符动画 */
        .empty-slot {
          transition: all 0.3s ease;
        }
        .empty-slot:hover {
          border-color: #40a9ff;
          background-color: #f6ffed;
        }
        
        /* 直播间标签页样式优化 */
        .ant-tabs-card > .ant-tabs-content {
          background: transparent;
        }
        
        .ant-tabs-card > .ant-tabs-content > .ant-tabs-tabpane {
          background: transparent;
          border: none;
        }
        
        .ant-tabs-card > .ant-tabs-nav .ant-tabs-tab {
          background: white;
          border: 1px solid #d9d9d9;
          margin-right: 4px;
          border-radius: 6px 6px 0 0;
          padding: 6px 12px;
          font-size: 12px;
        }
        
        .ant-tabs-card > .ant-tabs-nav .ant-tabs-tab-active {
          background: #1890ff;
          border-color: #1890ff;
          color: white;
        }
        
        .ant-tabs-card > .ant-tabs-nav .ant-tabs-tab-active * {
          color: white !important;
        }
        
        /* 卡片标题样式优化 */
        .ant-card-head {
          border-bottom: 1px solid #f0f0f0;
        }
        
        .ant-card-head-title {
          font-size: 14px;
          font-weight: 600;
        }
        
        /* 排班区域样式 */
        .ant-card-body {
          padding: 12px;
        }
        
        /* 按钮样式优化 */
        .ant-btn-sm {
          height: 24px;
          padding: 0 7px;
          font-size: 12px;
        }
        
        /* 标签样式优化 */
        .ant-tag {
          border-radius: 4px;
          font-weight: 500;
        }
        
        /* 头像样式优化 */
        .ant-avatar {
          border: 2px solid #fff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        /* 网格布局优化 */
        .anchor-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
          justify-items: stretch;
        }
        
        /* 响应式优化 */
        @media (max-width: 1400px) {
          .anchor-grid {
            grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          }
        }
        
        @media (max-width: 1200px) {
          .anchor-grid {
            grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          }
        }
      `}</style>
    </div>
  );
};

export default AnchorManagement; 